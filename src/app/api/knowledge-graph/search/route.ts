import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { searchKnowledgeNodes } from "@/lib/knowledge-graph";
import { getErrorMessage } from "@/lib/error-message";

const logger = createLogger('api:knowledge-graph:search');

/** 按关键词搜索图谱节点（换知识点用）；空关键词返回空数组，不做全量列表 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return unauthorized("Authentication required");

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) return unauthorized("Authentication required");

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const subject = (url.searchParams.get("subject") ?? "").trim();
    const limit = Number(url.searchParams.get("limit") ?? 20);

    if (q.length < 1) return NextResponse.json({ ok: true, nodes: [] });
    if (q.length > 60) return NextResponse.json({ ok: true, nodes: [] });

    try {
        const nodes = await searchKnowledgeNodes(q, subject || undefined, Number.isFinite(limit) ? limit : 20);
        return NextResponse.json({ ok: true, nodes });
    } catch (error) {
        logger.error({ error, q }, '搜索图谱节点失败');
        return internalError(getErrorMessage(error));
    }
}
