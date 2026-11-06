"use client";

/**
 * 页面底部的频谱条：一排竖向柱条做高低起伏，参考音频可视化。
 * 纯 CSS 动画，柱高与节奏由下标推导（固定值），服务端渲染也不会有水合差异。
 * 不接收点击，打印时隐藏；系统开启「减少动态效果」时静止。
 */
const BAR_COUNT = 88;

/** 由下标推导出确定性的高度、周期与相位，避免随机数导致 SSR/CSR 不一致 */
function barStyle(index: number) {
    const height = 14 + ((index * 37) % 78);
    const duration = 1.6 + ((index * 23) % 160) / 100;
    const delay = -((index * 53) % 320) / 100;
    return {
        height: `${height}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
    };
}

export function PageSpectrum() {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 flex h-[110px] items-end gap-[3px] overflow-hidden px-1 opacity-70 print:hidden"
        >
            {Array.from({ length: BAR_COUNT }, (_, index) => (
                <span
                    key={index}
                    style={barStyle(index)}
                    className="min-w-[2px] flex-1 origin-bottom rounded-t-[2px] bg-gradient-to-t from-sky-400/35 via-sky-300/25 to-sky-200/5 dark:from-sky-400/50 dark:via-sky-300/35 dark:to-sky-200/10 motion-safe:animate-[spectrum_2.4s_ease-in-out_infinite]"
                />
            ))}
        </div>
    );
}
