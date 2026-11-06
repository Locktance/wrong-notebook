"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { frontendLogger } from "@/lib/frontend-logger";
import type { KnowledgeNodeOption } from "@/types/knowledge-graph";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subject?: string;
    onPick: (node: KnowledgeNodeOption) => void;
    labels: {
        title: string;
        placeholder: string;
        noResult: string;
        emptyTitle: string;
    };
}

interface SearchResult {
    keyword: string;
    nodes: KnowledgeNodeOption[];
}

/** 主考点选择：只允许从图谱节点里选，避免自由输入对不上 id */
export function KnowledgeNodePicker({ open, onOpenChange, subject, onPick, labels }: Props) {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<SearchResult>({ keyword: "", nodes: [] });
    const [loading, setLoading] = useState(false);
    const keyword = query.trim();

    useEffect(() => {
        if (!open || !keyword) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await apiClient.get<{ nodes: KnowledgeNodeOption[] }>(
                    `/api/knowledge-graph/search?q=${encodeURIComponent(keyword)}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`,
                );
                if (!cancelled) setResult({ keyword, nodes: res.nodes ?? [] });
            } catch (error) {
                frontendLogger.error('[KnowledgeChain]', '搜索知识点失败', { error });
                if (!cancelled) setResult({ keyword, nodes: [] });
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 220);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, keyword, subject]);

    // 只展示「当前关键词」对应的结果，避免旧结果闪一下
    const nodes = result.keyword === keyword ? result.nodes : [];
    const searched = result.keyword === keyword && keyword.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{labels.title}</DialogTitle>
                </DialogHeader>
                <Input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={labels.placeholder}
                />
                <div className="max-h-80 space-y-1 overflow-auto">
                    {loading && <p className="p-2 text-sm text-muted-foreground">…</p>}
                    {!loading && searched && nodes.length === 0 && (
                        <p className="p-2 text-sm text-muted-foreground">{labels.noResult}</p>
                    )}
                    {!loading && !searched && <p className="p-2 text-sm text-muted-foreground">{labels.emptyTitle}</p>}
                    {nodes.map((node) => (
                        <Button
                            key={node.id}
                            variant="ghost"
                            className="h-auto w-full justify-start py-2 text-left"
                            onClick={() => {
                                onPick(node);
                                onOpenChange(false);
                            }}
                        >
                            <span className="flex flex-col">
                                <span className="text-sm">{node.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {[node.grade ? `G${node.grade}` : "", node.chapter ?? ""].filter(Boolean).join(" · ")}
                                </span>
                            </span>
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
