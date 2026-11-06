/**
 * 错题 → 图谱节点 的自动匹配（离线、无 AI 调用）。
 *
 * 思路：优先用错题已有的知识点标签（AI 分析时已经抽过），其次用题干/解析原文做子串命中。
 * 中文没有分词也能用：图谱节点名本身就是「配方法」「平方差公式」这类专有短语，直接匹配准确率足够。
 * 打分：标签名精确命中 100；题干包含节点名 60+名称长度；章节命中 20。
 */
import { prisma } from "@/lib/prisma";

export interface NodeCandidate {
    id: string;
    name: string;
    grade: number | null;
    score: number;
    reason: "tag" | "question" | "analysis" | "ai";
}

/** 学科 key 归一：中文学科名 → 图谱里的英文 key */
export function normalizeSubjectKey(subjectKey: string | null): string | null {
    if (!subjectKey) return null;
    const map: Record<string, string> = {
        数学: "math", 语文: "chinese", 英语: "english", 物理: "physics", 化学: "chemistry",
        生物: "biology", 历史: "history", 地理: "geography", 政治: "politics", 道德与法治: "politics", 科学: "science",
    };
    return map[subjectKey] ?? subjectKey;
}

/** 文字归一：去掉空白、全角标点，便于子串匹配 */
function normalize(text: string): string {
    return text.replace(/[\s，。、；：？！（）【】「」《》,.;:?!()\[\]<>"'`~·—-]/g, "");
}

export function scoreNode(nodeName: string, text: string, tags: string[]): NodeCandidate["score"] | null {
    const name = normalize(nodeName);
    if (!name) return null;
    if (tags.some((tag) => normalize(tag) === name)) return 100;
    if (tags.some((tag) => normalize(tag).includes(name))) return 80;
    // 反向包含：标签「一元二次方程」命中节点「一元二次方程的概念」
    if (tags.some((tag) => name.includes(normalize(tag)))) return 70;
    if (text.includes(name)) return 60 + Math.min(name.length, 8);
    return null;
}

/**
 * 自动为错题挑主考点：取分数最高的节点。
 * subjectKey 有值时只在该学科里找（避免「面积」命中英语）。
 */
export async function rankCandidateNodes(item: {
    questionText: string | null;
    ocrText: string | null;
    analysis: string | null;
    mistakeAnalysis: string | null;
    tags: { name: string }[];
    subjectKey: string | null;
}, limit = 20): Promise<NodeCandidate[]> {
    const tags = item.tags.map((tag) => tag.name);
    const question = normalize([item.questionText, item.ocrText].filter(Boolean).join(""));
    const analysis = normalize([item.analysis, item.mistakeAnalysis].filter(Boolean).join("").slice(0, 800));
    if (!question && !analysis && tags.length === 0) return [];

    // 学科 key 可能是 math，也可能被存成「数学」，两种都试；过滤后为空就退回全库，
    // 宁可跨学科多给几个候选，也不要因为 subject 字段对不上而一个都不返回。
    const key = normalizeSubjectKey(item.subjectKey);
    let nodes = key
        ? await prisma.knowledgeNode.findMany({ where: { subject: key }, select: { id: true, name: true, grade: true } })
        : [];
    if (nodes.length === 0) {
        nodes = await prisma.knowledgeNode.findMany({ select: { id: true, name: true, grade: true } });
    }

    const ranked: NodeCandidate[] = [];
    for (const node of nodes) {
        const tagScore = scoreNode(node.name, question, tags);
        let score = tagScore;
        let reason: NodeCandidate["reason"] = "tag";
        if (score === null && analysis) {
            const name = normalize(node.name);
            if (name && analysis.includes(name)) {
                score = 40 + Math.min(name.length, 8);
                reason = "analysis";
            }
        } else if (score !== null && score < 80 && question.includes(normalize(node.name))) {
            reason = "question";
        }
        if (score === null) continue;
        ranked.push({ id: node.id, name: node.name, grade: node.grade, score, reason });
    }
    return ranked.sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit));
}
