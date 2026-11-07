"use client";

import type { CSSProperties } from "react";

/**
 * 页面底部的频谱条。
 *
 * 观感目标：像一段真实的声音频谱，而不是等距等高的一排方块。所以每根柱条的高度、
 * 起伏幅度、周期、甚至宽度都带一点确定性的"抖动"（由下标推导，不用随机数，
 * 保证 SSR 与客户端一致）；整体仍保留一条横向行进的正弦包络，波峰从左往右流动。
 *
 * 不接收点击，打印时隐藏；系统开启「减少动态效果」时静止。
 */
const BAR_COUNT = 96;
/** 一次起伏的基础周期（秒） */
const BASE_DURATION = 3.2;
/** 相邻柱条的相位差：决定波峰跑多快 */
const PHASE_STEP = 0.07;
/** 横向贯穿的波峰个数（基础包络） */
const WAVE_CRESTS = 3;

/** 由下标推导的伪随机数（0~1），替代 Math.random 以保持服务端/客户端一致 */
function jitter(index: number, seed: number): number {
    const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
    return Math.abs(value % 1);
}

function barStyle(index: number): CSSProperties {
    // 基础包络：3 个波峰的柔和正弦
    const envelope = 0.5 + 0.5 * Math.sin((index / BAR_COUNT) * Math.PI * 2 * WAVE_CRESTS);
    // 叠加两层抖动：整体高矮和粗糙度
    const heightNoise = jitter(index, 1);
    const shapeNoise = jitter(index, 2);
    const height = 8 + envelope * 46 * (0.55 + 0.75 * heightNoise);
    // 每根柱子回落的程度不同，避免整齐的"呼吸"
    const low = 0.2 + 0.45 * shapeNoise;
    // 周期轻微不一致，长时间看不至于机械
    const duration = BASE_DURATION * (0.9 + 0.2 * shapeNoise);

    return {
        height: `${height}px`,
        flexGrow: 0.7 + 0.6 * shapeNoise,
        animationDuration: `${duration}s`,
        animationDelay: `${-(index * PHASE_STEP)}s`,
        "--bar-low": low.toFixed(3),
    } as CSSProperties;
}

export function PageSpectrum() {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 flex h-[100px] items-end gap-[2px] overflow-hidden px-1 opacity-80 print:hidden"
        >
            {Array.from({ length: BAR_COUNT }, (_, index) => (
                <span
                    key={index}
                    style={barStyle(index)}
                    className="min-w-[2px] flex-1 origin-bottom rounded-t-[2px] bg-gradient-to-t from-sky-500/45 via-sky-400/40 to-sky-300/30 motion-safe:animate-[spectrum_3.2s_ease-in-out_infinite] dark:from-sky-400/55 dark:via-sky-300/45 dark:to-sky-200/35"
                />
            ))}
        </div>
    );
}
