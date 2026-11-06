"use client";

import { Atom, BookOpen, BookText, ChevronRight, FlaskConical, Globe, Landmark, Languages, Leaf, Scale, Sigma } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NotebookScopeLabel } from "@/components/notebook-scope-label";
import { resolveNotebookScope } from "@/lib/notebook-scope";
import type { NotebookSubject } from "@/lib/notebook-scope";
import { cn } from "@/lib/utils";

interface NotebookCardProps {
    name: string;
    stage?: string | null;
    subjectKey?: string | null;
    errorCount: number;
    /** 已格式化好的「更新于 …」，不传则不显示 */
    updatedLabel?: string;
    onClick: () => void;
    itemLabel?: string;
}

/** 各学科的图标、底色与顶部色条，便于在列表中一眼区分 */
const SUBJECT_STYLE: Record<NotebookSubject, { icon: LucideIcon; className: string; stripe: string }> = {
    math: { icon: Sigma, className: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300", stripe: "from-blue-500 to-blue-400" },
    english: { icon: Languages, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", stripe: "from-emerald-500 to-emerald-400" },
    chinese: { icon: BookText, className: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300", stripe: "from-rose-500 to-rose-400" },
    physics: { icon: Atom, className: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300", stripe: "from-amber-500 to-amber-400" },
    chemistry: { icon: FlaskConical, className: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300", stripe: "from-teal-500 to-teal-400" },
    biology: { icon: Leaf, className: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", stripe: "from-lime-500 to-lime-400" },
    history: { icon: Landmark, className: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300", stripe: "from-orange-500 to-orange-400" },
    geography: { icon: Globe, className: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300", stripe: "from-cyan-500 to-cyan-400" },
    politics: { icon: Scale, className: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300", stripe: "from-red-500 to-red-400" },
};

const DEFAULT_STYLE = {
    icon: BookOpen,
    className: "bg-accent text-accent-foreground",
    stripe: "from-primary to-primary/40",
};

export function NotebookCard({ name, stage, subjectKey, errorCount, updatedLabel, onClick, itemLabel = "items" }: NotebookCardProps) {
    const scope = resolveNotebookScope({ name, stage, subjectKey });
    const style = scope.subject ? SUBJECT_STYLE[scope.subject] : DEFAULT_STYLE;
    const Icon = style.icon;

    return (
        <article
            role="link"
            tabIndex={0}
            className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter") onClick();
            }}
        >
            {/* 顶部学科色条 */}
            <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", style.stripe)} />

            <div className="flex items-start justify-between gap-2">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.className)}>
                    <Icon className="h-[18px] w-[18px]" />
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>

            {/* 宽屏把学段/学科做成右侧徽标，窄屏放标题下面，避免卡片中间空一块 */}
            <div className="mt-2.5 flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate font-semibold">{name}</h3>
                <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
                    <NotebookScopeLabel notebook={{ name, stage, subjectKey }} />
                </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground sm:hidden">
                <NotebookScopeLabel notebook={{ name, stage, subjectKey }} />
            </p>

            <div className="mt-2.5 flex items-end justify-between gap-2">
                <p className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold leading-none tabular-nums">{errorCount}</span>
                    <span className="text-xs text-muted-foreground">{itemLabel}</span>
                </p>
                {updatedLabel && <span className="text-[11px] text-muted-foreground">{updatedLabel}</span>}
            </div>
        </article>
    );
}
