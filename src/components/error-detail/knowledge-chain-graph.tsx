"use client";

import { useMemo } from "react";
import type { KnowledgeChain, KnowledgeChainNode } from "@/types/knowledge-graph";
import { cn } from "@/lib/utils";

interface Props {
    chain: KnowledgeChain;
    selectedId: string | null;
    /** 学生实际出错的考点 id，红色高亮 */
    errorId?: string | null;
    labels: {
        root: string;
        level: (depth: number) => string;
        more: (count: number) => string;
    };
    onSelect: (node: KnowledgeChainNode) => void;
}

const COL_W = 212;
const ROW_H = 76;
const NODE_W = 178;
const NODE_H = 62;
/** 列间距（跨层连线在空隙里走，不压方框） */
const GAP = COL_W - NODE_W;
/** 每列最多展示的节点数，超出折叠为「另有 N 个」，保证一屏能看完 */
const MAX_PER_COL = 4;
const HEADER_Y = 20;
const TOP = 34;

/** 估算字符宽度：拉丁字母按半个字宽算，中文按一个字宽算 */
function charUnits(char: string): number {
    return /[\x00-\xff]/.test(char) ? 0.56 : 1;
}

function fitLine(text: string, maxUnits: number): string {
    let out = "";
    let units = 0;
    for (const char of text) {
        const width = charUnits(char);
        if (units + width > maxUnits) return `${out}…`;
        out += char;
        units += width;
    }
    return out;
}

/** 按字数折行，最多 maxLines 行，超出补省略号（SVG 没有文本折行，只能自己算） */
function wrapName(name: string, maxUnits: number, maxLines: number): string[] {
    const lines: string[] = [];
    let buffer = "";
    let units = 0;
    let truncated = false;
    for (const char of name) {
        const width = charUnits(char);
        if (units + width > maxUnits && buffer) {
            lines.push(buffer);
            buffer = "";
            units = 0;
            if (lines.length === maxLines) {
                truncated = true;
                break;
            }
        }
        buffer += char;
        units += width;
    }
    if (truncated) {
        lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
    } else if (buffer && lines.length < maxLines) {
        lines.push(buffer);
    }
    return lines.slice(0, maxLines);
}

/** 相邻层走平滑曲线，视觉上更轻；跨层仍走正交折线，避免穿过中间的方框 */

/**
 * 分层图：
 * - 同层按父节点平均行号排序（barycenter），减少交叉
 * - 每列顶部对齐，逐列向下铺开
 * - 相邻层：父右边缘 → 子左边缘 平滑曲线；跨层：列间空隙里正交折线
 * - 主考点、硬前置、软前置、错点各有独立视觉标记
 */
export function KnowledgeChainGraph({ chain, selectedId, errorId, labels, onSelect }: Props) {
    const { columns, width, height, positions, hidden } = useMemo(() => {
        const byDepth = new Map<number, KnowledgeChainNode[]>();
        for (const node of chain.nodes) {
            const list = byDepth.get(node.depth) ?? [];
            list.push(node);
            byDepth.set(node.depth, list);
        }
        const depths = [...byDepth.keys()].sort((a, b) => a - b);
        const hiddenMap = new Map<number, number>();
        for (const depth of depths) {
            const list = byDepth.get(depth) ?? [];
            if (list.length > MAX_PER_COL) {
                hiddenMap.set(depth, list.length - MAX_PER_COL);
                byDepth.set(depth, list.slice(0, MAX_PER_COL));
            }
        }

        const parentsOf = new Map<string, string[]>();
        for (const edge of chain.edges) {
            const list = parentsOf.get(edge.to) ?? [];
            list.push(edge.from);
            parentsOf.set(edge.to, list);
        }

        const rowOf = new Map<string, number>();
        const ordered: KnowledgeChainNode[][] = [];

        depths.forEach((depth, index) => {
            const nodes = [...(byDepth.get(depth) ?? [])];
            if (index === 0) {
                nodes.forEach((node, row) => rowOf.set(node.id, row));
            } else {
                const bary = (node: KnowledgeChainNode) => {
                    const rows = (parentsOf.get(node.id) ?? [])
                        .map((id) => rowOf.get(id))
                        .filter((row): row is number => row !== undefined);
                    return rows.length ? rows.reduce((sum, row) => sum + row, 0) / rows.length : Number.MAX_SAFE_INTEGER;
                };
                nodes.sort((a, b) => bary(a) - bary(b) || a.name.localeCompare(b.name));
                nodes.forEach((node, row) => rowOf.set(node.id, row));
            }
            ordered.push(nodes);
        });

        const maxRows = Math.max(...ordered.map((nodes) => nodes.length), 1);
        const pos = new Map<string, { x: number; y: number }>();
        ordered.forEach((nodes, colIndex) => {
            nodes.forEach((node, row) => {
                pos.set(node.id, { x: colIndex * COL_W + 12, y: TOP + row * ROW_H });
            });
        });

        return {
            columns: ordered.map((nodes, index) => ({ depth: depths[index], nodes })),
            width: Math.max(ordered.length * COL_W + 16, 240),
            height: TOP + (maxRows - 1) * ROW_H + NODE_H + (hiddenMap.size ? 40 : 24),
            positions: pos,
            hidden: hiddenMap,
        };
    }, [chain.nodes, chain.edges]);

    return (
        <div className="overflow-x-auto">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={chain.nodeName}
                // 手机上按最小可读宽度渲染并允许横向滑动，避免整图缩到看不清
                style={{ width: "max(100%, 720px)", height: "auto" }}
                preserveAspectRatio="xMidYMid meet"
            >
                {/* 列分隔线：弱化到几乎看不见，只用来暗示层级 */}
                {columns.slice(1).map((col, index) => (
                    <line
                        key={`sep-${col.depth}`}
                        x1={(index + 1) * COL_W - 6}
                        y1={TOP - 12}
                        x2={(index + 1) * COL_W - 6}
                        y2={height - (hidden.size ? 26 : 10)}
                        className="stroke-border/70"
                        strokeWidth={1}
                        strokeDasharray="2 6"
                    />
                ))}

                {/* 列标题 */}
                {columns.map((col, ci) => (
                    <g key={`h-${col.depth}`}>
                        <circle
                            cx={ci * COL_W + 17}
                            cy={HEADER_Y - 3.5}
                            r={3}
                            className={col.depth === 0 ? "fill-primary" : "fill-muted-foreground/40"}
                        />
                        <text
                            x={ci * COL_W + 25}
                            y={HEADER_Y}
                            className={cn(
                                "text-[11px] tracking-wide",
                                col.depth === 0 ? "fill-primary font-medium" : "fill-muted-foreground",
                            )}
                        >
                            {col.depth === 0 ? labels.root : labels.level(col.depth)}
                        </text>
                    </g>
                ))}

                {/* 连线：保持原来的细线与走向，不加箭头，免得看着更乱 */}
                {chain.edges.map((edge) => {
                    const from = positions.get(edge.from);
                    const to = positions.get(edge.to);
                    if (!from || !to) return null;
                    const x1 = from.x + NODE_W;
                    const y1 = from.y + NODE_H / 2;
                    const x2 = to.x;
                    const y2 = to.y + NODE_H / 2;
                    const lineClass = edge.strength === "soft" ? "stroke-muted-foreground/40" : "stroke-primary/50";
                    const dash = edge.strength === "soft" ? "4 3" : undefined;

                    // 相邻层：平滑曲线
                    if (Math.abs(x2 - x1) <= COL_W) {
                        const mid = (x1 + x2) / 2;
                        return (
                            <path
                                key={`${edge.from}-${edge.to}`}
                                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                                fill="none"
                                className={lineClass}
                                strokeWidth={1.4}
                                strokeDasharray={dash}
                            />
                        );
                    }

                    // 跨层：在列间空隙做正交折线，避免穿过中间列的方框
                    const channelX = x2 > x1 ? x2 - GAP / 2 : x2 + GAP / 2;
                    return (
                        <path
                            key={`${edge.from}-${edge.to}`}
                            d={`M${x1},${y1} H${channelX} V${y2} H${x2}`}
                            fill="none"
                            className={lineClass}
                            strokeWidth={1.2}
                            strokeDasharray={dash}
                        />
                    );
                })}

                {/* 节点 */}
                {columns.map((col) =>
                    col.nodes.map((node) => {
                        const pos = positions.get(node.id);
                        if (!pos) return null;
                        const isSelected = node.id === selectedId;
                        const isError = Boolean(errorId) && node.id === errorId;
                        const isRoot = node.depth === 0;
                        const titleLines = wrapName(node.name, 12, 2);
                        // 章节末尾的编号（如 13.2）对判断层级没用，先去掉再排版，减少省略号
                        const chapter = (node.chapter ?? "").replace(/\s+\d+(?:\.\d+)*\s*$/, "");
                        const meta = [node.grade ? `G${node.grade}` : "", chapter].filter(Boolean).join(" · ");
                        const singleLine = titleLines.length === 1;

                        return (
                            <g
                                key={node.id}
                                transform={`translate(${pos.x},${pos.y})`}
                                className="group cursor-pointer"
                                role="button"
                                tabIndex={0}
                                aria-label={`${node.name}${meta ? ` ${meta}` : ""}`}
                                onClick={() => onSelect(node)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        onSelect(node);
                                    }
                                }}
                            >
                                <title>{[node.name, meta].filter(Boolean).join(" · ")}</title>
                                <rect
                                    width={NODE_W}
                                    height={NODE_H}
                                    rx={12}
                                    strokeWidth={isSelected || isError ? 1.8 : 1}
                                    className={cn(
                                        "transition-colors duration-150",
                                        isRoot ? "fill-primary/[0.07]" : "fill-card",
                                        isError
                                            ? "stroke-red-400/70 group-hover:stroke-red-400"
                                            : isSelected
                                              ? "stroke-primary"
                                              : isRoot
                                                ? "stroke-primary/35 group-hover:stroke-primary/60"
                                                : "stroke-border group-hover:stroke-primary/40",
                                    )}
                                />
                                {/* 错点：左侧红色竖条 + 右上角圆点，比整圈红线更安静 */}
                                {isError && (
                                    <>
                                        <rect x={0.5} y={10} width={3} height={NODE_H - 20} rx={1.5} className="fill-red-400" />
                                        <circle cx={NODE_W - 12} cy={12} r={3} className="fill-red-400" />
                                    </>
                                )}
                                <text x={12} y={singleLine ? 27 : 22} className="fill-foreground text-[12px] font-medium">
                                    {titleLines[0]}
                                </text>
                                {!singleLine && (
                                    <text x={12} y={38} className="fill-foreground text-[12px] font-medium">
                                        {titleLines[1]}
                                    </text>
                                )}
                                <text
                                    x={12}
                                    y={NODE_H - 12}
                                    className={cn("text-[10px]", isRoot ? "fill-primary/70" : "fill-muted-foreground")}
                                >
                                    {fitLine(meta, 15)}
                                </text>
                            </g>
                        );
                    }),
                )}

                {[...hidden.entries()].map(([depth, count]) => {
                    const colIndex = columns.findIndex((col) => col.depth === depth);
                    return (
                        <text
                            key={`hidden-${depth}`}
                            x={Math.max(colIndex, 0) * COL_W + 14}
                            y={height - 8}
                            className="fill-muted-foreground/80 text-[10px]"
                        >
                            {labels.more(count)}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}
