/**
 * 知识图谱查询：先修链（多链、学段隔离）、节点检索、主考点读写。
 *
 * 规则（按需求确认）：
 * - 一道错题最多挂 4 个考点（1 主 + 最多 3 相关），每个考点各生成一条链
 * - 每条链最多展开 4 层
 * - 小学（G1–6）/ 初中（G7–9）/ 高中（G10–12）互相隔离，只沿同学段节点回溯
 * - 多条链按相关性排序；链内按「层级浅 → 硬前置优先 → 年级高」
 */
import { prisma } from "@/lib/prisma";
import type {
    ChainStrength,
    KnowledgeChain,
    KnowledgeChainEdge,
    KnowledgeChainNode,
    KnowledgeChains,
} from "@/types/knowledge-graph";

const MAX_DEPTH = 4;
const MAX_CHAINS = 4;
const MAX_NODES_PER_CHAIN = 30;

export type Stage = "primary" | "junior" | "senior" | "unknown";

export function stageOfGrade(grade: number | null | undefined): Stage {
    if (!grade || grade < 1) return "unknown";
    if (grade <= 6) return "primary";
    if (grade <= 9) return "junior";
    return "senior";
}

const STRENGTH_RANK: Record<string, number> = { hard: 0, soft: 1 };

type RawAncestor = { nodeId: string; depth: number | bigint };

interface NodeRow {
    id: string;
    cnmId: string;
    name: string;
    subject: string;
    grade: number | null;
    chapter: string | null;
    description: string | null;
    diagnosticQuestion: string | null;
    diagnosticAnswer: string | null;
}

/** 取某节点的所有前置（最多 depth 层），每条节点保留最小层级 */
async function collectAncestors(nodeId: string, depth: number): Promise<{ nodeId: string; depth: number }[]> {
    const rows = await prisma.$queryRawUnsafe<RawAncestor[]>(
        `WITH RECURSIVE chain(nodeId, depth) AS (
             SELECT e."fromNodeId", 1
             FROM "KnowledgeEdge" e
             WHERE e."toNodeId" = ?
           UNION
             SELECT e."fromNodeId", chain.depth + 1
             FROM "KnowledgeEdge" e
             JOIN chain ON e."toNodeId" = chain.nodeId
             WHERE chain.depth < ?
         )
         SELECT nodeId, MIN(depth) AS depth
         FROM chain
         GROUP BY nodeId`,
        nodeId,
        depth,
    );
    // SQLite 的 MIN(depth) 经 Prisma 原生查询返回 BigInt，必须转 number，
    // 否则 sort 的比较函数返回 BigInt 会抛 "Cannot convert a BigInt value to a number"
    return rows.map((row) => ({ nodeId: row.nodeId, depth: Number(row.depth) }));
}

/** 单个考点的链：只保留与主考点同学段的节点 */
async function buildChain(primary: NodeRow, depth: number): Promise<KnowledgeChain> {
    const stage = stageOfGrade(primary.grade);
    const all = await collectAncestors(primary.id, depth);

    const ancestorIds = all.map((row) => row.nodeId);
    const gradeRows = ancestorIds.length
        ? await prisma.knowledgeNode.findMany({
            where: { id: { in: ancestorIds } },
            select: { id: true, grade: true },
        })
        : [];
    const gradeById = new Map(gradeRows.map((row) => [row.id, row.grade]));

    // 学段隔离：小/初/高各自独立，跨学段直接断开
    const sameStage = stage === "unknown"
        ? all
        : all.filter((row) => stageOfGrade(gradeById.get(row.nodeId)) === stage);

    const truncated = sameStage.length > MAX_NODES_PER_CHAIN;
    const kept = sameStage
        .sort((a, b) => a.depth - b.depth || a.nodeId.localeCompare(b.nodeId))
        .slice(0, MAX_NODES_PER_CHAIN);
    const ids = [primary.id, ...kept.map((row) => row.nodeId)];

    const [nodes, edges] = await Promise.all([
        prisma.knowledgeNode.findMany({ where: { id: { in: ids } } }),
        prisma.knowledgeEdge.findMany({ where: { fromNodeId: { in: ids }, toNodeId: { in: ids } } }),
    ]);

    const depthOf = new Map(kept.map((row) => [row.nodeId, row.depth]));
    const strengthOf = new Map<string, string>();
    for (const edge of edges) {
        const cur = strengthOf.get(edge.toNodeId);
        const rank = STRENGTH_RANK[edge.strength] ?? 9;
        if (cur === undefined || rank < (STRENGTH_RANK[cur] ?? 9)) {
            strengthOf.set(edge.toNodeId, edge.strength);
        }
    }

    const mapped: KnowledgeChainNode[] = nodes
        .map((node) => ({
            id: node.id,
            cnmId: node.cnmId,
            name: node.name,
            subject: node.subject,
            grade: node.grade,
            chapter: node.chapter,
            description: node.description ?? "",
            diagnosticQuestion: node.diagnosticQuestion ?? null,
            diagnosticAnswer: node.diagnosticAnswer ?? null,
            depth: node.id === primary.id ? 0 : (depthOf.get(node.id) ?? 99),
            strength: (node.id === primary.id ? "primary" : (strengthOf.get(node.id) ?? "hard")) as ChainStrength,
        }))
        .sort((a, b) =>
            a.depth - b.depth
            || (STRENGTH_RANK[a.strength] ?? 2) - (STRENGTH_RANK[b.strength] ?? 2)
            || (b.grade ?? 0) - (a.grade ?? 0),
        );

    const mappedEdges: KnowledgeChainEdge[] = edges.map((edge) => ({
        from: edge.fromNodeId,
        to: edge.toNodeId,
        strength: edge.strength,
    }));

    return {
        nodeId: primary.id,
        nodeName: primary.name,
        grade: primary.grade,
        nodes: mapped,
        edges: mappedEdges,
        truncated,
        risk: "先修边待一线教师审核，高中题未做盲解复核，结论仅作参考",
    };
}

function parseRelated(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const value: unknown = JSON.parse(raw);
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch {
        return [];
    }
}

/** 读取某道错题的全部知识链（主考点 + 相关考点，最多 4 条） */
export async function getKnowledgeChains(
    itemId: string,
    userId: string,
    depth = MAX_DEPTH,
): Promise<KnowledgeChains | null> {
    const item = await prisma.errorItem.findFirst({
        where: { id: itemId, userId },
        select: {
            id: true,
            questionText: true,
            ocrText: true,
            primaryNodeId: true,
            relatedNodeIds: true,
            errorNodeId: true,
            nodeSource: true,
        },
    });
    if (!item) return null;

    const base: KnowledgeChains = {
        item: {
            id: item.id,
            title: item.questionText ?? item.ocrText ?? "",
            primaryNodeId: null,
            relatedNodeIds: [],
            errorNodeId: null,
            nodeSource: item.nodeSource,
        },
        chains: [],
    };
    if (!item.primaryNodeId) return base;

    const clamped = Math.min(Math.max(depth, 1), MAX_DEPTH);
    const ids = [item.primaryNodeId, ...parseRelated(item.relatedNodeIds)].slice(0, MAX_CHAINS);

    const nodes = await prisma.knowledgeNode.findMany({ where: { id: { in: ids } } });
    const byId = new Map(nodes.map((node) => [node.id, node as unknown as NodeRow]));
    const primary = byId.get(item.primaryNodeId);
    if (!primary) return base;

    const ordered = [
        primary,
        ...ids.slice(1).map((id) => byId.get(id)).filter((node): node is NodeRow => Boolean(node)),
    ];
    const chains = await Promise.all(ordered.map((node) => buildChain(node, clamped)));

    return {
        item: {
            id: item.id,
            title: item.questionText ?? item.ocrText ?? "",
            primaryNodeId: primary.id,
            relatedNodeIds: ordered.slice(1).map((node) => node.id),
            errorNodeId: item.errorNodeId ?? null,
            nodeSource: item.nodeSource,
        },
        chains,
    };
}

/** 按关键词检索图谱节点（换知识点时用） */
export async function searchKnowledgeNodes(query: string, subject?: string, limit = 20) {
    const q = query.trim();
    if (!q) return [];
    return prisma.knowledgeNode.findMany({
        where: {
            ...(subject ? { subject } : {}),
            OR: [{ name: { contains: q } }, { chapter: { contains: q } }, { cnmId: { contains: q } }],
        },
        orderBy: [{ grade: "desc" }, { name: "asc" }],
        take: Math.min(Math.max(limit, 1), 50),
        select: { id: true, cnmId: true, name: true, subject: true, grade: true, chapter: true },
    });
}

/** 设置主考点（手选）：清空相关考点，只留一条链 */
export async function setPrimaryNode(itemId: string, userId: string, nodeId: string | null) {
    const item = await prisma.errorItem.findFirst({ where: { id: itemId, userId }, select: { id: true } });
    if (!item) return { ok: false as const, reason: "not-found" as const };

    if (nodeId) {
        const node = await prisma.knowledgeNode.findUnique({ where: { id: nodeId }, select: { id: true } });
        if (!node) return { ok: false as const, reason: "node-not-found" as const };
    }

    await prisma.errorItem.update({
        where: { id: item.id },
        data: { primaryNodeId: nodeId, relatedNodeIds: null, errorNodeId: null, nodeSource: nodeId ? "user" : null },
    });
    return { ok: true as const };
}

/** 保存自动识别的多考点（主 + 相关，全部同学段） */
export async function saveMatchedNodes(
    itemId: string,
    userId: string,
    primaryId: string,
    relatedIds: string[],
    errorNodeId: string | null = null,
) {
    const item = await prisma.errorItem.findFirst({ where: { id: itemId, userId }, select: { id: true } });
    if (!item) return false;
    await prisma.errorItem.update({
        where: { id: item.id },
        data: {
            primaryNodeId: primaryId,
            relatedNodeIds: relatedIds.length ? JSON.stringify(relatedIds.slice(0, MAX_CHAINS - 1)) : null,
            errorNodeId,
            nodeSource: "ai",
        },
    });
    return true;
}

export const KNOWLEDGE_CHAIN_LIMITS = { MAX_DEPTH, MAX_CHAINS, MAX_NODES_PER_CHAIN };
