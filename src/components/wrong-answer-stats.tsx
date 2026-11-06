"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

import { Loader2, TrendingUp, CheckCircle, BookOpen } from "lucide-react";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { StatCard } from "@/components/ui/stat-card";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import { chartColor, CHART_AXIS, CHART_GRID } from "@/lib/chart-theme";
import { frontendLogger } from "@/lib/frontend-logger";
import { AnalyticsData } from "@/types/api";

export function WrongAnswerStats() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();

    const fetchAnalytics = useCallback(async () => {
        try {
            const data = await apiClient.get<AnalyticsData>("/api/analytics");
            setData(data);
        } catch (error) {
            frontendLogger.error('[WrongAnswerStats]', 'Failed to fetch analytics', { error });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据请求：进入页面或条件变化时加载，请求前后更新加载状态和结果
        fetchAnalytics();
    }, [fetchAnalytics]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    const subjectTotal = data.subjectStats.reduce((sum, entry) => sum + entry.value, 0);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 标题由外层 PageHeader 与 Tab 承担，这里只放指标和三张图 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <StatCard
                    label={t.wrongAnswerStats.totalErrors}
                    value={data.totalErrors}
                    hint={t.wrongAnswerStats.totalErrorsDesc}
                    icon={BookOpen}
                    tone="primary"
                    hintClassName="hidden sm:block"
                />
                <StatCard
                    label={t.wrongAnswerStats.mastered}
                    value={data.masteredCount}
                    hint={t.wrongAnswerStats.masteredDesc}
                    icon={CheckCircle}
                    tone="success"
                    hintClassName="hidden sm:block"
                />
                <StatCard
                    label={t.wrongAnswerStats.masteryRate}
                    value={`${data.masteryRate}%`}
                    hint={t.wrongAnswerStats.masteryRateDesc}
                    icon={TrendingUp}
                    tone="warning"
                    hintClassName="hidden sm:block"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Subject Distribution */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.wrongAnswerStats.SubjectDistribution}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.subjectStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="36%"
                                    outerRadius="50%"
                                    fill="var(--chart-1)"
                                    paddingAngle={data.subjectStats.length > 1 ? 4 : 0}
                                    dataKey="value"
                                    stroke="var(--card)"
                                    strokeWidth={data.subjectStats.length > 1 ? 2 : 0}
                                >
                                    {data.subjectStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={chartColor(index)} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    content={() => (
                                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
                                            {data.subjectStats.map((entry, index) => (
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

                {/* Monthly Trend */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>{t.wrongAnswerStats.MonthlyTrend}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="wrongAnswerBarFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.85} />
                                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.15} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...CHART_GRID} vertical={false} />
                                <XAxis dataKey="date" {...CHART_AXIS} dy={10} />
                                <YAxis {...CHART_AXIS} tickFormatter={(value) => `${value}`} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }} />
                                <Bar
                                    dataKey="count"
                                    name={t.wrongAnswerStats.activity}
                                    fill="url(#wrongAnswerBarFill)"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
