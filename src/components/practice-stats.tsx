"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { StatCard } from "@/components/ui/stat-card";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Loader2, TrendingUp, BookOpen, Target } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { CHART_AXIS, CHART_GRID, CHART_SEMANTIC, chartColor } from "@/lib/chart-theme";
import { frontendLogger } from "@/lib/frontend-logger";
import type { Translations } from "@/lib/translations";
import { PracticeStatsData } from "@/types/api";

const DIFFICULTY_COLORS: Record<string, string> = {
    'easy': CHART_SEMANTIC.easy,
    'medium': CHART_SEMANTIC.medium,
    'hard': CHART_SEMANTIC.hard,
    'harder': CHART_SEMANTIC.harder,
    'Unknown': CHART_SEMANTIC.unknown,
};

/** recharts 传给自定义提示框的参数（只列出用到的字段） */
interface ChartTooltipProps {
    active?: boolean;
    payload?: Array<{ name?: string | number; value?: string | number; color?: string }>;
    label?: string | number;
}

const CustomTooltip = ({ active, payload, label, t }: ChartTooltipProps & { t: Translations }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">
                            {entry.name}:
                        </span>
                        <span className="font-medium">
                            {entry.value}
                        </span>
                    </div>
                ))}
                <div className="mt-2 pt-2 border-t flex justify-between gap-4">
                    <span className="text-muted-foreground">{t.stats?.total || "Total"}:</span>
                    <span className="font-bold">
                        {payload.reduce((acc, curr) => acc + (typeof curr.value === 'number' ? curr.value : 0), 0)}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export function PracticeStats() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<PracticeStatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get<PracticeStatsData>("/api/stats/practice")
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                frontendLogger.error('[PracticeStats]', 'Failed to fetch stats', { error: err });
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!stats || stats.overallStats.total === 0) {
        return null; // Don't show if no data
    }

    // Helper to translate difficulty
    const getDifficultyLabel = (key: string) => {
        const labels: Record<string, string | undefined> = t.practice?.difficulty ?? {};
        return labels[key] || key;
    };

    // Get unique difficulties for the bar chart
    const difficulties = stats.difficultyStats.map(d => d.name);
    const subjectTotal = stats.subjectStats.reduce((sum, entry) => sum + entry.value, 0);

    return (
        <div className="space-y-4">
            {/* 标题由外层 PageHeader 与 Tab 承担，这里只放指标和图表 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <StatCard
                    label={t.stats?.totalPractices || "Total Practiced"}
                    value={stats.overallStats.total}
                    icon={BookOpen}
                    tone="primary"
                />
                <StatCard
                    label={t.stats?.correctRate || "Correct Rate"}
                    value={`${stats.overallStats.rate}%`}
                    hint={`${stats.overallStats.correct} / ${stats.overallStats.total} ${t.stats?.correct || "Correct"}`}
                    hintClassName="hidden sm:block"
                    icon={Target}
                    tone="success"
                />
                <StatCard
                    label={t.stats?.activeDays || "Active Days (6m)"}
                    value={stats.activityStats.filter(d => d.total > 0).length}
                    icon={TrendingUp}
                    tone="warning"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Subject Distribution */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.stats?.subjectDistribution || "Subject Distribution"}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.subjectStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="36%"
                                    outerRadius="50%"
                                    fill="var(--chart-1)"
                                    paddingAngle={stats.subjectStats.length > 1 ? 4 : 0}
                                    dataKey="value"
                                    stroke="var(--card)"
                                    strokeWidth={stats.subjectStats.length > 1 ? 2 : 0}
                                >
                                    {stats.subjectStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={chartColor(index)} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    content={() => (
                                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
                                            {stats.subjectStats.map((entry, index) => (
                                                <span key={entry.name} className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColor(index) }} />
                                                    {entry.name}
                                                    <span className="tabular-nums text-foreground/70">
                                                        {subjectTotal > 0 ? Math.round((entry.value / subjectTotal) * 100) : 0}%
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Monthly Activity with Difficulty Stack */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.stats?.weeklyTrend || "Monthly Trend"}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.activityStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid {...CHART_GRID} vertical={false} />
                                <XAxis dataKey="date" {...CHART_AXIS} dy={10} />
                                <YAxis allowDecimals={false} {...CHART_AXIS} />
                                <Tooltip content={<CustomTooltip t={t} />} cursor={{ fill: 'transparent' }} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ paddingTop: '20px' }}
                                />
                                {difficulties.map((diff, index) => (
                                    <Bar
                                        key={diff}
                                        dataKey={diff}
                                        name={getDifficultyLabel(diff)}
                                        stackId="a"
                                        fill={DIFFICULTY_COLORS[diff] ?? chartColor(index)}
                                        radius={index === difficulties.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                        barSize={32}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
