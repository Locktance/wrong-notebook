"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { frontendLogger } from "@/lib/frontend-logger";
import { cn } from "@/lib/utils";
import type { TagStats } from "@/types/api";
import { SUBJECTS, getSubjectName } from "./tag-subjects";
import type { SubjectKey, TagTreeNode } from "./tag-subjects";
import { TagTreeNodeView } from "./tag-tree-node";

interface StandardTagsProps {
    tagSet: string;
    stats: TagStats[];
}

/**
 * 标准标签库：学科以紧凑磁贴列出并显示知识点数量，点开后在下方展开该学科的标签树。
 * 相比原来每个学科一张大卡片，一屏能看到全部学科。
 */
export function StandardTags({ tagSet, stats }: StandardTagsProps) {
    const { t } = useLanguage();
    // 未出现的学科表示尚未加载，[] 表示已加载但无数据
    const [tagsBySubject, setTagsBySubject] = useState<Partial<Record<SubjectKey, TagTreeNode[]>>>({});
    const [selectedSubject, setSelectedSubject] = useState<SubjectKey | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
    // 按标签 ID 查使用次数，避免不同学科、体系的同名标签互相串数
    const countByTagId = useMemo(() => {
        const map = new Map<string, number>();
        for (const stat of stats) {
            if (stat.tagSet !== tagSet) continue;
            for (const id of stat.tagIds) map.set(id, stat.count);
        }
        return map;
    }, [stats, tagSet]);

    const fetchTags = useCallback(async (subject: SubjectKey) => {
        try {
            const data = await apiClient.get<{ tags: TagTreeNode[] }>(`/api/tags?subject=${subject}&tagSet=${encodeURIComponent(tagSet)}`);
            setTagsBySubject(prev => ({ ...prev, [subject]: data.tags }));
        } catch (error) {
            frontendLogger.error('[Tags]', 'Failed to fetch tags', { subject, tagSet, error });
        }
    }, [tagSet]);

    // 进页面就把各学科都拉一遍，磁贴上才能显示知识点数量
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据请求：进入页面时加载各学科标签
        for (const { key } of SUBJECTS) void fetchTags(key);
    }, [fetchTags]);

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    const selectedTags = selectedSubject ? tagsBySubject[selectedSubject] : undefined;
    const selectedSystemTags = selectedTags?.filter(tag => tag.isSystem) ?? [];
    const systemCountOf = (subject: SubjectKey) => {
        const tags = tagsBySubject[subject];
        return tags ? tags.filter(tag => tag.isSystem).length : undefined;
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {SUBJECTS.map(({ key, name }) => {
                    const isActive = selectedSubject === key;
                    const count = systemCountOf(key);
                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setSelectedSubject(isActive ? null : key)}
                            className={cn(
                                "group flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left transition-colors",
                                isActive
                                    ? "border-primary/50 bg-primary/[0.04]"
                                    : "border-border/70 hover:border-primary/40 hover:bg-muted/40",
                            )}
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                    {getSubjectName(t.tags?.subjects, key, name)}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                                    {count === undefined ? "…" : t.tags.tagCount.replace("{count}", String(count))}
                                </span>
                            </span>
                            <ChevronRight
                                className={cn(
                                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                    isActive && "rotate-90 text-primary",
                                )}
                            />
                        </button>
                    );
                })}
            </div>

            {selectedSubject && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
                        <CardTitle className="text-base">
                            {getSubjectName(t.tags?.subjects, selectedSubject, selectedSubject)}
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSubject(null)}>
                            {t.common?.collapse || "Collapse"}
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                        {!selectedTags ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t.tags?.stats?.loading || "Loading..."}
                            </div>
                        ) : selectedSystemTags.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                {t.tags?.stats?.empty || "No tag usage records yet"}
                            </p>
                        ) : (
                            selectedSystemTags.map(node => (
                                <TagTreeNodeView key={node.id} node={node} countByTagId={countByTagId} expandedNodes={expandedNodes} onToggle={toggleNode} />
                            ))
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
