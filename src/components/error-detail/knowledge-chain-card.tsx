"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeChainGraph } from "@/components/error-detail/knowledge-chain-graph";
import { KnowledgeNodePicker } from "@/components/error-detail/knowledge-node-picker";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import { frontendLogger } from "@/lib/frontend-logger";
import { toast } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import type { KnowledgeChain, KnowledgeChainNode, KnowledgeChains, KnowledgeNodeOption } from "@/types/knowledge-graph";

interface Props {
    errorItemId: string;
}

export function KnowledgeChainCard({ errorItemId }: Props) {
    const { t } = useLanguage();
    const labels = t.detail.knowledgeChain;
    const [data, setData] = useState<KnowledgeChains | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [selected, setSelected] = useState<KnowledgeChainNode | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autoRunning, setAutoRunning] = useState(false);
    const [autoFailed, setAutoFailed] = useState(false);
    const detailRef = useRef<HTMLDivElement | null>(null);

    // 窄屏上点节点后详情面板可能在折叠区外，滚到刚好看得见
    useEffect(() => {
        if (!selected) return;
        detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selected]);

    const chains = data?.chains ?? [];
    const active: KnowledgeChain | null = chains[activeIndex] ?? chains[0] ?? null;
    const errorName = data?.item.errorNodeId
        ? (chains.flatMap((chain) => chain.nodes).find((node) => node.id === data.item.errorNodeId)?.name ?? null)
        : null;

    const load = useCallback(async () => {
        try {
            const result = await apiClient.get<KnowledgeChains>(
                `/api/error-items/${errorItemId}/knowledge-chain?depth=4`,
            );
            setData(result);
            setActiveIndex(0);
        } catch (error) {
            frontendLogger.error('[KnowledgeChain]', '加载知识链失败', { error });
            toast.error(labels.loadFailed);
        } finally {
            setLoading(false);
        }
    }, [errorItemId, labels.loadFailed]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据请求：进入页面时加载知识链，请求完成后写入状态
        void load();
    }, [load]);

    // 没有考点时自动识别一次（离线排序 → AI 从候选里挑 1–4 个，全部同学段）
    useEffect(() => {
        if (loading || !data || data.item.primaryNodeId || autoRunning || autoFailed) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据请求：首次进入且无考点时自动识别
        setAutoRunning(true);
        apiClient.post<{ matched: boolean; chains?: KnowledgeChains }>(
            `/api/error-items/${errorItemId}/knowledge-chain/auto`,
            {},
        )
            .then((res) => {
                if (res?.chains?.item.primaryNodeId) {
                    setData(res.chains);
                    setActiveIndex(0);
                    setExpanded(true);
                } else {
                    setAutoFailed(true);
                }
            })
            .catch((error) => {
                frontendLogger.error('[KnowledgeChain]', '自动识别考点失败', { error });
                setAutoFailed(true);
            })
            .finally(() => setAutoRunning(false));
    }, [loading, data, autoRunning, autoFailed, errorItemId]);

    const reidentify = async () => {
        setAutoRunning(true);
        setAutoFailed(false);
        try {
            const res = await apiClient.post<{ matched: boolean; chains?: KnowledgeChains }>(
                `/api/error-items/${errorItemId}/knowledge-chain/auto`,
                { force: true },
            );
            if (res?.chains) {
                setData(res.chains);
                setActiveIndex(0);
                setSelected(null);
                setExpanded(true);
                if (!res.matched) setAutoFailed(true);
            }
        } catch (error) {
            frontendLogger.error('[KnowledgeChain]', '重新识别失败', { error });
            toast.error(labels.autoFailed);
        } finally {
            setAutoRunning(false);
        }
    };

    const savePrimary = async (node: KnowledgeNodeOption | null) => {
        setSaving(true);
        try {
            const result = await apiClient.post<KnowledgeChains>(
                `/api/error-items/${errorItemId}/knowledge-chain`,
                { nodeId: node?.id ?? null },
            );
            setData(result);
            setActiveIndex(0);
            setSelected(null);
            setExpanded(Boolean(result.item.primaryNodeId));
        } catch (error) {
            frontendLogger.error('[KnowledgeChain]', '保存主考点失败', { error });
            toast.error(labels.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </CardHeader>
                <CardContent>
                    <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden border-border/70">
            {/* 顶部一条极细的靛蓝渐变，替代整块彩色卡片 */}
            <div className="h-[3px] w-full bg-gradient-to-r from-primary/80 via-primary/30 to-transparent" />

            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3 pt-4">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base leading-none">{labels.title}</CardTitle>
                            {chains.length > 1 && (
                                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px] font-normal text-muted-foreground">
                                    {labels.chainCount.replace("{n}", String(chains.length))}
                                </Badge>
                            )}
                            {errorName && (
                                <Badge
                                    variant="outline"
                                    className="gap-1 rounded-full border-red-500/25 bg-red-500/[0.07] px-2 py-0 text-[11px] font-normal text-red-600 dark:text-red-400"
                                >
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                    {labels.legendError}：{errorName}
                                </Badge>
                            )}
                        </div>
                        {active && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                {(!expanded || chains.length === 1) && (
                                    <>
                                        {active.nodeName}
                                        {active.nodes.length > 1 && <span className="mx-1.5 text-border">·</span>}
                                    </>
                                )}
                                {active.nodes.length > 1 &&
                                    labels.chainMeta
                                        .replace("{n}", String(active.nodes.length - 1))
                                        .replace("{d}", String(Math.max(...active.nodes.map((node) => node.depth))))}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        aria-label={labels.reidentify}
                        title={labels.reidentify}
                        onClick={() => void reidentify()}
                        disabled={autoRunning || saving}
                    >
                        {autoRunning ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-1 h-3.5 w-3.5" />
                        )}
                        <span className="hidden sm:inline">{labels.reidentify}</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        aria-label={active ? labels.change : labels.pick}
                        onClick={() => setPickerOpen(true)}
                        disabled={saving}
                    >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        {active ? labels.change : labels.pick}
                    </Button>
                    {active && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg"
                            aria-label={expanded ? labels.collapse : labels.expand}
                            title={expanded ? labels.collapse : labels.expand}
                            aria-expanded={expanded}
                            onClick={() => setExpanded((value) => !value)}
                        >
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">{expanded ? labels.collapse : labels.expand}</span>
                        </Button>
                    )}
                </div>
            </CardHeader>

            {!active && (
                <CardContent className="pb-5 pt-0">
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            {autoRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {autoRunning ? labels.autoMatching : autoFailed ? labels.autoFailed : labels.empty}
                        </p>
                        {!autoRunning && <p className="max-w-sm text-xs text-muted-foreground/80">{labels.emptyHint}</p>}
                        {!autoRunning && (
                            <Button size="sm" variant="outline" className="mt-1 rounded-lg" onClick={() => setPickerOpen(true)}>
                                {labels.pickManually}
                            </Button>
                        )}
                    </div>
                </CardContent>
            )}

            {active && expanded && (
                <CardContent className="space-y-3 pb-4 pt-0">
                    {/* 多链切换：主考点在前，相关考点按匹配分排序 */}
                    {chains.length > 1 && (
                        <div className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1">
                            {chains.map((chain, index) => {
                                const isActive = index === activeIndex;
                                return (
                                    <button
                                        key={chain.nodeId}
                                        type="button"
                                        aria-pressed={isActive}
                                        onClick={() => {
                                            setActiveIndex(index);
                                            setSelected(null);
                                        }}
                                        className={cn(
                                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                                            isActive
                                                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                                                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                                        )}
                                    >
                                        {chain.nodeName}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                                {labels.legendMain}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-[2px] w-4 rounded-full bg-primary/50" />
                                {labels.legendHard}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-4 border-t border-dashed border-muted-foreground/50" />
                                {labels.legendSoft}
                            </span>
                            {errorName && (
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-red-400" />
                                    {labels.legendError}
                                </span>
                            )}
                        </div>
                        <span className="text-[11px] text-muted-foreground/70 sm:hidden">{labels.swipeHint}</span>
                    </div>

                    <div className="relative">
                        <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-card p-2 sm:p-3">
                            <KnowledgeChainGraph
                                chain={active}
                                selectedId={selected?.id ?? null}
                                errorId={data?.item.errorNodeId ?? null}
                                labels={{
                                    root: labels.root,
                                    level: (depth) => labels.level.replace("{n}", String(depth)),
                                    more: (count) => labels.more.replace("{n}", String(count)),
                                }}
                                onSelect={setSelected}
                            />
                        </div>
                        {/* 窄屏提示右侧还有内容 */}
                        <div className="pointer-events-none absolute inset-y-3 right-0 w-10 rounded-r-xl bg-gradient-to-l from-card to-transparent sm:hidden" />
                    </div>

                    {active.truncated && <p className="text-[11px] text-muted-foreground">{labels.truncated}</p>}

                    {selected && (
                        <div ref={detailRef} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{selected.name}</span>
                                <Badge
                                    variant={selected.depth === 0 ? "default" : "secondary"}
                                    className="rounded-full px-2 py-0 text-[11px] font-normal"
                                >
                                    {selected.depth === 0 ? labels.primary : labels.level.replace("{n}", String(selected.depth))}
                                </Badge>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                                {selected.grade && <span className="rounded-full bg-muted px-2 py-0.5">G{selected.grade}</span>}
                                {selected.chapter && <span className="rounded-full bg-muted px-2 py-0.5">{selected.chapter}</span>}
                            </div>
                            {selected.description && (
                                <p className="mt-3 text-sm leading-relaxed text-foreground/90">{selected.description}</p>
                            )}
                            {selected.diagnosticQuestion && (
                                <div className="mt-3 rounded-lg border border-border/50 bg-muted/40 p-3">
                                    <p className="text-[11px] font-medium text-muted-foreground">{labels.diagnostic}</p>
                                    <p className="mt-1 text-sm">{selected.diagnosticQuestion}</p>
                                    {selected.diagnosticAnswer && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {labels.answer}：{selected.diagnosticAnswer}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
                        <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
                        {active.risk || labels.risk}
                    </p>
                </CardContent>
            )}

            <KnowledgeNodePicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                subject={active?.nodes[0]?.subject}
                onPick={(node) => void savePrimary(node)}
                labels={{
                    title: labels.pick,
                    placeholder: labels.searchPlaceholder,
                    noResult: labels.noResult,
                    emptyTitle: labels.searchPlaceholder,
                }}
            />
        </Card>
    );
}
