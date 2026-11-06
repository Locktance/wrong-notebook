interface TooltipItem {
    name?: string | number;
    value?: string | number;
    color?: string;
}

interface ChartTooltipProps {
    active?: boolean;
    payload?: TooltipItem[];
    label?: string | number;
}

/**
 * 统一的图表提示框：popover 底色 + 主题色圆点，
 * 深色模式下不会出现白底闪烁（Recharts 默认 Tooltip 是白底）。
 */
export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
            {label !== undefined && label !== "" && <p className="mb-1 font-medium">{label}</p>}
            <div className="space-y-0.5">
                {payload.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name !== undefined && <span className="text-muted-foreground">{item.name}</span>}
                        <span className="font-semibold tabular-nums">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
