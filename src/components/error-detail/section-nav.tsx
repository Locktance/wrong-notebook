"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
    id: string;
    label: string;
}

interface SectionNavProps {
    items: SectionNavItem[];
    className?: string;
}

/** 吸顶栏 + 顶部导航的总高度，判断「当前区块」时用 */
const ACTIVE_OFFSET = 132;

/**
 * 详情页分区锚点：吸顶在顶部导航下方，滚动时高亮当前区块，点击平滑跳转。
 * 锚点是插在各区块前的空元素，所以这里按滚动位置判断当前区块。
 */
export function SectionNav({ items, className }: SectionNavProps) {
    const [active, setActive] = useState(items[0]?.id ?? "");
    const ids = items.map((item) => item.id).join(",");

    useEffect(() => {
        const update = () => {
            let current = ids.split(",")[0];
            for (const id of ids.split(",")) {
                const element = document.getElementById(id);
                if (element && element.getBoundingClientRect().top <= ACTIVE_OFFSET) current = id;
            }
            setActive(current);
        };
        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [ids]);

    const jump = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        const element = document.getElementById(id);
        if (!element) return;
        event.preventDefault();
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        setActive(id);
        window.history.replaceState(null, "", `#${id}`);
    };

    return (
        <nav
            aria-label="section navigation"
            className={cn(
                "sticky top-14 z-30 -mx-4 border-y border-border/60 bg-background/85 px-4 py-2 backdrop-blur print:hidden md:top-16 md:-mx-8 md:px-8",
                className,
            )}
        >
            <ul className="flex gap-1 overflow-x-auto">
                {items.map((item) => {
                    const isActive = item.id === active;
                    return (
                        <li key={item.id} className="shrink-0">
                            <a
                                href={`#${item.id}`}
                                aria-current={isActive ? "true" : undefined}
                                onClick={(event) => jump(event, item.id)}
                                className={cn(
                                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                {item.label}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
