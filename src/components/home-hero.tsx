"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookOpen, CalendarCheck, ListChecks, PlusCircle, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface HomeHeroProps {
    notebookCount: number;
    itemCount: number;
    /** 今日待复习的错题数，加载完成前为 null */
    dueCount: number | null;
    /** 从错题本页进入时的目标错题本名称 */
    targetNotebook?: string;
}

const subscribeNothing = () => () => {};

interface StatTileProps {
    href: string;
    icon: LucideIcon;
    label: string;
    value: number | null;
}

function StatTile({ href, icon: Icon, label, value }: StatTileProps) {
    return (
        <Link
            href={href}
            className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm transition-colors hover:bg-white/20"
        >
            <div className="flex items-center gap-1.5 text-[11px] text-white/75">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums md:text-2xl">{value ?? "–"}</div>
        </Link>
    );
}

/** 首页顶部欢迎区：问候语 + 今日任务主按钮 + 错题本/错题/待复习数量 */
export function HomeHero({ notebookCount, itemCount, dueCount, targetNotebook }: HomeHeroProps) {
    const { t, language } = useLanguage();
    const { data: session } = useSession();
    // 问候语依赖本地时间，服务端渲染时返回 null，避免两端渲染不一致
    const hour = useSyncExternalStore(subscribeNothing, () => new Date().getHours(), () => null);

    const greeting = hour === null
        ? t.common.welcome.replace(/[，,\s]+$/, "")
        : hour < 12 ? t.home.greetingMorning
            : hour < 18 ? t.home.greetingAfternoon
                : t.home.greetingEvening;
    const name = session?.user?.name || session?.user?.email || "";
    const hasDue = typeof dueCount === "number" && dueCount > 0;

    return (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-5 text-white shadow-lg shadow-indigo-500/20 md:p-7">
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-2xl" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
                <div className="min-w-0 space-y-2.5">
                    <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                        {greeting}{name && `${language === "zh" ? "，" : ", "}${name}`}
                    </h1>
                    <p className="max-w-md text-sm text-white/80">{t.home.heroSubtitle}</p>
                    {targetNotebook && (
                        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                            <Target className="h-3.5 w-3.5" />
                            {t.home.targetNotebook.replace("{name}", targetNotebook)}
                        </p>
                    )}

                    {/* 有到期复习就直接给主按钮，没有就让用户直接去录入 */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {hasDue ? (
                            <Link
                                href="/review"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-white/90"
                            >
                                <CalendarCheck className="h-4 w-4" />
                                {t.home.heroCtaReview.replace("{count}", String(dueCount))}
                            </Link>
                        ) : (
                            <a
                                href="#upload-zone"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-white/90"
                            >
                                <PlusCircle className="h-4 w-4" />
                                {t.home.heroCtaAdd}
                            </a>
                        )}
                    </div>
                </div>

                <div className="grid w-full grid-cols-3 gap-2 md:w-80 md:shrink-0">
                    <StatTile href="/notebooks" icon={BookOpen} label={t.home.notebookCount} value={notebookCount} />
                    <StatTile href="/notebooks" icon={ListChecks} label={t.home.itemCount} value={itemCount} />
                    <StatTile href="/review" icon={CalendarCheck} label={t.home.dueCount} value={dueCount} />
                </div>
            </div>
        </section>
    );
}
