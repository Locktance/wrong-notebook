import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-muted-foreground",
} as const;

type Tone = keyof typeof TONES;

interface StatCardProps {
    /** 指标名，如「累计错题」 */
    label: string;
    /** 指标值，数字或带单位的字符串 */
    value: React.ReactNode;
    /** 值下面的补充说明 */
    hint?: string;
    icon?: LucideIcon;
    tone?: Tone;
    className?: string;
    /** 说明文字的附加样式，窄屏下想隐藏说明时用 */
    hintClassName?: string;
}

/**
 * 统一的指标卡：标题 / 数值 / 说明 + 右上角淡色图标。
 * 全站的统计数字都用它，避免每处各写一套 Card 结构。
 */
export function StatCard({ label, value, hint, icon: Icon, tone = "primary", className, hintClassName }: StatCardProps) {
    return (
        <Card className={cn("gap-0 border-border/70 py-0 shadow-sm", className)}>
            <CardContent className="flex items-start justify-between gap-2 p-3 sm:p-4">
                <div className="min-w-0">
                    <p className="text-[11px] leading-tight font-medium text-muted-foreground sm:truncate sm:text-xs">{label}</p>
                    <p className="mt-1.5 text-xl font-bold leading-none tabular-nums sm:text-2xl">{value}</p>
                    {hint && <p className={cn("mt-1.5 truncate text-[11px] text-muted-foreground/80", hintClassName)}>{hint}</p>}
                </div>
                {Icon && (
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8", TONES[tone])}>
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </span>
                )}
            </CardContent>
        </Card>
    );
}
