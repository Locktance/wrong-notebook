"use client";

/**
 * 页面底部的频谱条。
 *
 * 动效是一条横向行进的波浪：所有柱条共用同一套起伏关键帧，但按下标逐根错开相位，
 * 于是"波峰"会从左往右跑过整排柱子——看起来是波形在流动，而不是每根各闪各的。
 * 基础高度也按正弦轮廓分布，静态时已经是一条起伏的曲线。
 *
 * 不接收点击，打印时隐藏；系统开启「减少动态效果」时静止。
 */
const BAR_COUNT = 96;
/** 一次起伏的周期（秒） */
const DURATION = 3.2;
/** 相邻柱条的相位差：决定波峰跑多快 */
const PHASE_STEP = 0.07;
/** 横向贯穿的波峰个数（基础轮廓） */
const WAVE_CRESTS = 3;

function barStyle(index: number) {
    // 基础轮廓：3 个波峰的柔和正弦，避免静态时是一排随机高矮
    const envelope = 0.5 + 0.5 * Math.sin((index / BAR_COUNT) * Math.PI * 2 * WAVE_CRESTS);
    const height = 14 + envelope * 52;
    return {
        height: `${height}px`,
        animationDuration: `${DURATION}s`,
        animationDelay: `${-(index * PHASE_STEP)}s`,
    };
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
                    className="min-w-[2px] flex-1 origin-bottom rounded-t-[2px] bg-gradient-to-t from-sky-400/35 via-sky-300/25 to-sky-200/5 motion-safe:animate-[spectrum_3.2s_ease-in-out_infinite] dark:from-sky-400/50 dark:via-sky-300/35 dark:to-sky-200/10"
                />
            ))}
        </div>
    );
}
