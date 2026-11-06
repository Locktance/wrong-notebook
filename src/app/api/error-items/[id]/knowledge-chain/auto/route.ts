import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, notFound, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { getKnowledgeChains, saveMatchedNodes, stageOfGrade, KNOWLEDGE_CHAIN_LIMITS } from "@/lib/knowledge-graph";
import { rankCandidateNodes, type NodeCandidate } from "@/lib/knowledge-graph-match";
import { getAIService } from "@/lib/ai";
import { getErrorMessage } from "@/lib/error-message";

const logger = createLogger('api:error-items:knowledge-chain:auto');

/** 学科 key → 中文名（AI 提示词用） */
/** 从「初二上 / 高一 / 小学三年级」这类文本推断学段 */
function stageOfSemester(text: string | null | undefined) {
    const value = String(text ?? "");
    if (/小学|小[一二三四五六]/.test(value)) return "primary" as const;
    if (/初[一二三]|七年级|八年级|九年级/.test(value)) return "junior" as const;
    if (/高[一二三]/.test(value)) return "senior" as const;
    return "unknown" as const;
}

/** 解析老字段 knowledgePoints（JSON 数组或逗号分隔），返回知识点名称 */
function parseKnowledgePoints(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const value: unknown = JSON.parse(raw);
        if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
        if (typeof value === "string") return [value];
        if (value && typeof value === "object") {
            const names = (value as Record<string, unknown>).knowledgePoints;
            if (Array.isArray(names)) return names.filter((item): item is string => typeof item === "string");
        }
    } catch {
        return raw.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

const SUBJECT_ZH: Record<string, string> = {
    math: '数学', english: '英语', physics: '物理', chemistry: '化学',
    biology: '生物', chinese: '语文', history: '历史', geography: '地理',
    politics: '道德与法治', science: '科学',
};

/**
 * 自动识别考点：离线打分排序 → AI 从候选里挑 1–4 个 → 落库。
 * 全部限制在同一学段（小/初/高），每个考点各生成一条链。
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const body = await req.json().catch(() => null) as { force?: boolean } | null;
    const force = body?.force === true;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return unauthorized("Authentication required");

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) return unauthorized("Authentication required");

    try {
        const item = await prisma.errorItem.findFirst({
            where: { id, userId: user.id },
            select: {
                id: true,
                primaryNodeId: true,
                questionText: true,
                ocrText: true,
                gradeSemester: true,
                analysis: true,
                mistakeAnalysis: true,
                wrongAnswerText: true,
                knowledgePoints: true,
                tags: { select: { name: true } },
                subject: { select: { subjectKey: true } },
            },
        });
        if (!item) return notFound("Item not found");

        // force=true 表示用户主动点「重新识别」，忽略已有结果重算
        if (item.primaryNodeId && !force) {
            const chains = await getKnowledgeChains(id, user.id);
            return NextResponse.json({ matched: false, reason: "already-set", chains });
        }

        // 知识点来源不止 tags：老字段 knowledgePoints（JSON）也要算，否则标签没同步时召回全空
        const legacyTags = parseKnowledgePoints(item.knowledgePoints);
        const tagNames = [...new Set([...item.tags.map((tag) => tag.name), ...legacyTags])];

        const candidates = await rankCandidateNodes({
            questionText: item.questionText,
            ocrText: item.ocrText,
            analysis: item.analysis,
            mistakeAnalysis: item.mistakeAnalysis,
            tags: tagNames.map((name) => ({ name })),
            subjectKey: item.subject?.subjectKey ?? null,
        });

        // 学段优先：错题年级所在学段有足够强的候选就用它，否则回退全学科候选
        const itemStage = stageOfSemester(item.gradeSemester);
        const preferred = itemStage === "unknown"
            ? []
            : candidates.filter((node) => stageOfGrade(node.grade) === itemStage);
        const strongPreferred = preferred.filter((node) => node.score >= 60);
        const strongAll = candidates.filter((node) => node.score >= 60);

        if (strongPreferred.length === 0 && strongAll.length === 0) {
            const chains = await getKnowledgeChains(id, user.id);
            return NextResponse.json({ matched: false, reason: "no-confident-match", chains });
        }

        // 同一学段内取候选池，避免一条链里混进小学/初中/高中
        const basePool = strongPreferred.length > 0 ? preferred : candidates;
        const topStage = stageOfGrade((strongPreferred[0] ?? strongAll[0]).grade);
        const pool = basePool.filter((node) => stageOfGrade(node.grade) === topStage);
        const strong = pool.filter((node) => node.score >= 60);

        let picked: NodeCandidate[] = strong.slice(0, KNOWLEDGE_CHAIN_LIMITS.MAX_CHAINS);

        // AI 复核：只允许从同候选里选 1–4 个；失败则用离线结果
        if (item.subject?.subjectKey) {
            try {
                const subjectZh = SUBJECT_ZH[item.subject.subjectKey] ?? '数学';
                const result = await getAIService().suggestKnowledgeTags({
                    questionText: item.questionText ?? item.ocrText ?? "",
                    analysis: item.analysis,
                    mistakeAnalysis: item.mistakeAnalysis,
                    subject: subjectZh,
                    allowedTags: pool.map((node) => node.name),
                });
                const aiPicked = result.tags
                    .map((name) => pool.find((node) => node.name === name))
                    .filter((node): node is NodeCandidate => Boolean(node));
                const unique = [...new Map(aiPicked.map((node) => [node.id, node])).values()];
                if (unique.length > 0) {
                    // AI 的结果优先，但用离线强候选补足：AI 每次挑的个数不稳定，
                    // 会让同一道题的链数量忽多忽少（实测出现过 3 条变 2 条）
                    const merged = [...unique];
                    for (const candidate of strong) {
                        if (!merged.some((node) => node.id === candidate.id)) merged.push(candidate);
                    }
                    picked = merged.slice(0, KNOWLEDGE_CHAIN_LIMITS.MAX_CHAINS);
                }
            } catch (error) {
                logger.warn({ error: getErrorMessage(error), itemId: id }, 'AI 复核失败，回退离线匹配');
            }
        }

        // 错点判断：用「学生错误解答 + 错因」让模型在已选考点里挑真正出错的那个；判不出留空
        let errorNodeId: string | null = null;
        const wrongPart = [item.wrongAnswerText, item.mistakeAnalysis].filter(Boolean).join("\n").slice(0, 1200);
        if (wrongPart && picked.length > 0 && item.subject?.subjectKey) {
            try {
                const judged = await getAIService().suggestKnowledgeTags({
                    questionText: `${item.questionText ?? item.ocrText ?? ""}\n\n【学生作答与错误分析】\n${wrongPart}`,
                    subject: SUBJECT_ZH[item.subject.subjectKey] ?? '数学',
                    allowedTags: picked.map((node) => node.name),
                });
                const hit = picked.find((node) => judged.tags.some(
                    (tag) => tag === node.name || tag.includes(node.name) || node.name.includes(tag),
                ));
                // AI 没给出可用结果时，退一步：看哪个考点名出现在错误解答/错因原文里
                const mentioned = picked.find((node) => wrongPart.includes(node.name));
                errorNodeId = (hit ?? mentioned)?.id ?? null;
            } catch (error) {
                logger.warn({ error: getErrorMessage(error), itemId: id }, '错点判断失败，跳过高亮');
            }
        }

        // 去掉互为前置的考点：A 是 B 的前置时，B 的链里已经含 A，不再单列
        // 合并父子考点：若 A 是 B 的直接前置，A 的内容已经出现在 B 的链里，不再单列。
        // 直接查一次边表，比递归更可控（实测递归版容易出现误判）。
        const pickedIds = picked.map((node) => node.id);
        const edges = await prisma.knowledgeEdge.findMany({
            where: { fromNodeId: { in: pickedIds }, toNodeId: { in: pickedIds } },
            select: { fromNodeId: true, toNodeId: true },
        });
        if (edges.length > 0) {
            // 父节点（在候选里至少有 2 个子节点）不单列：它的内容已经出现在每个子节点的链里。
            // 只保留子节点，链数从 4 变 3（三角形 / 应用 / 组解法）。
            const childCount = new Map<string, number>();
            for (const edge of edges) {
                childCount.set(edge.fromNodeId, (childCount.get(edge.fromNodeId) ?? 0) + 1);
            }
            const parents = new Set(
                [...childCount.entries()].filter(([, count]) => count >= 2).map(([id]) => id),
            );
            const kept = picked.filter((node) => !parents.has(node.id));
            if (kept.length >= 2) picked = kept;
        }

        const [primary, ...related] = picked;
        const saved = await saveMatchedNodes(id, user.id, primary.id, related.map((node) => node.id), errorNodeId);
        if (!saved) return notFound("Item not found");

        logger.info(
            { itemId: id, primary: primary.id, related: related.length, stage: topStage },
            '自动匹配考点',
        );
        const chains = await getKnowledgeChains(id, user.id);
        return NextResponse.json({ matched: true, nodes: picked.map((node) => ({ id: node.id, name: node.name, score: node.score })), chains });
    } catch (error) {
        logger.error({ error, itemId: id }, '自动识别考点失败');
        return internalError(getErrorMessage(error));
    }
}
