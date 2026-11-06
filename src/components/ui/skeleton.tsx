import { cn } from "@/lib/utils";

/** 骨架屏基础块：统一圆角、底色与脉冲动画 */
export function Skeleton({ className }: { className?: string }) {
    return <div aria-hidden className={cn("animate-pulse rounded-lg bg-foreground/15", className)} />;
}

interface CardGridSkeletonProps {
    count?: number;
    /** 栅格列数，默认三列（错题本、复习）；试卷页用两列 */
    columns?: 1 | 2 | 3;
    /** 卡片本身的附加样式 */
    cardClassName?: string;
    className?: string;
}

const COLUMN_CLASS: Record<1 | 2 | 3, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

/** 卡片栅格占位：首屏先给结构，避免整页转圈导致布局跳动 */
export function CardGridSkeleton({ count = 6, columns = 3, cardClassName, className }: CardGridSkeletonProps) {
    return (
        <div className={cn("grid gap-4", COLUMN_CLASS[columns], className)} role="status" aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className={cn("rounded-2xl border bg-card p-4", cardClassName)}>
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="mt-3 h-4 w-24" />
                    <Skeleton className="mt-2 h-3 w-16" />
                    <Skeleton className="mt-4 h-6 w-14" />
                </div>
            ))}
        </div>
    );
}

/** 标题 + 副标题的页头占位 */
export function PageHeaderSkeleton({ className }: { className?: string }) {
    return (
        <div aria-hidden className={cn("space-y-2", className)}>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
        </div>
    );
}
