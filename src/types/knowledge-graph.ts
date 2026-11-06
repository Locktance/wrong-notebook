/** 知识链相关的共享类型（服务端与前端共用） */

export type ChainStrength = "primary" | "hard" | "soft";

export interface KnowledgeChainNode {
    id: string;
    cnmId: string;
    name: string;
    subject: string;
    grade: number | null;
    chapter: string | null;
    description: string;
    diagnosticQuestion: string | null;
    diagnosticAnswer: string | null;
    /** 0 = 主考点，1..n = 前置层级（最多 4 层） */
    depth: number;
    strength: ChainStrength;
}

export interface KnowledgeChainEdge {
    from: string;
    to: string;
    strength: string;
}

/** 单个考点的一条链 */
export interface KnowledgeChain {
    /** 这条链的切入点（考点 id） */
    nodeId: string;
    nodeName: string;
    grade: number | null;
    nodes: KnowledgeChainNode[];
    edges: KnowledgeChainEdge[];
    truncated: boolean;
    risk: string;
}

export interface KnowledgeChains {
    item: {
        id: string;
        title: string;
        primaryNodeId: string | null;
        relatedNodeIds: string[];
        /** 学生实际出错的考点；为空表示没判断出来 */
        errorNodeId: string | null;
        nodeSource: string | null;
    };
    /** 主考点在前，相关考点按匹配分从高到低，最多 4 条 */
    chains: KnowledgeChain[];
}

export interface KnowledgeNodeOption {
    id: string;
    cnmId: string;
    name: string;
    subject: string;
    grade: number | null;
    chapter: string | null;
}
