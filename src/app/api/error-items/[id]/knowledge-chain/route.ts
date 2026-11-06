import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, notFound, badRequest, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { getKnowledgeChains, setPrimaryNode, KNOWLEDGE_CHAIN_LIMITS } from "@/lib/knowledge-graph";
import { getErrorMessage } from "@/lib/error-message";

const logger = createLogger('api:error-items:knowledge-chain');

async function currentUserId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    return user?.id ?? null;
}

/** 读取多链；depth 默认 4 层（1~4），每条链最多 4 层、最多 4 条链 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const userId = await currentUserId();
    if (!userId) return unauthorized("Authentication required");

    const url = new URL(req.url);
    const rawDepth = Number(url.searchParams.get("depth") ?? KNOWLEDGE_CHAIN_LIMITS.MAX_DEPTH);
    const depth = Number.isFinite(rawDepth)
        ? Math.min(Math.max(Math.trunc(rawDepth), 1), KNOWLEDGE_CHAIN_LIMITS.MAX_DEPTH)
        : KNOWLEDGE_CHAIN_LIMITS.MAX_DEPTH;

    try {
        const result = await getKnowledgeChains(id, userId, depth);
        if (!result) return notFound("Item not found");
        return NextResponse.json(result);
    } catch (error) {
        logger.error({ error, itemId: id }, '读取知识链失败');
        return internalError(getErrorMessage(error));
    }
}

/** 设置或清除主考点；body: { nodeId: string | null } */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const userId = await currentUserId();
    if (!userId) return unauthorized("Authentication required");

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return badRequest("请求体不是合法 JSON");
    }
    const raw = (body as { nodeId?: unknown } | null)?.nodeId;
    if (raw !== null && typeof raw !== "string") {
        return badRequest("nodeId 必须是字符串或 null");
    }
    const nodeId = raw === null ? null : raw.trim();
    if (nodeId === "") return badRequest("nodeId 不能是空字符串，清空请传 null");

    try {
        const result = await setPrimaryNode(id, userId, nodeId);
        if (!result.ok) {
            return result.reason === "node-not-found" ? notFound("Knowledge node not found") : notFound("Item not found");
        }
        const chains = await getKnowledgeChains(id, userId);
        return NextResponse.json(chains);
    } catch (error) {
        logger.error({ error, itemId: id, nodeId }, '设置主考点失败');
        return internalError(getErrorMessage(error));
    }
}
