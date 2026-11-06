/**
 * 图表统一主题。
 *
 * 颜色全部走 globals.css 里的设计 token（--chart-1..5、--border 等），
 * 这样浅色/深色模式自动跟随，也不会再出现 Recharts 默认色板那种荧光蓝。
 */
export const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
] as const;

/** 按序号取色，超出长度自动循环 */
export function chartColor(index: number): string {
    return CHART_COLORS[index % CHART_COLORS.length];
}

/** 网格线：用 border 色，深色下不会亮得刺眼 */
export const CHART_GRID = {
    stroke: "var(--border)",
    strokeDasharray: "3 3",
} as const;

/** 坐标轴：轴线很淡，刻度文字用 muted-foreground */
export const CHART_AXIS = {
    axisLine: false,
    tickLine: false,
    tick: { fill: "var(--muted-foreground)", fontSize: 12 },
} as const;

/** 难度等语义色，跟着主题走 */
export const CHART_SEMANTIC = {
    easy: "var(--success)",
    medium: "var(--warning)",
    hard: "var(--chart-3)",
    harder: "var(--destructive)",
    unknown: "var(--muted-foreground)",
} as const;
