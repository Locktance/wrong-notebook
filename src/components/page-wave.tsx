/**
 * 页面底部的波浪条带：两层错位的波形横向缓慢流动，作为频谱柱条背后的「水面」。
 * 纯装饰层，不接收点击，打印时隐藏；系统开启「减少动态效果」时保持静止。
 */
const WAVE_PATH = "M0,100 C120,60 240,60 360,100 C480,140 600,140 720,100 C840,60 960,60 1080,100 C1200,140 1320,140 1440,100 C1560,60 1680,60 1800,100 C1920,140 2040,140 2160,100 C2280,60 2400,60 2520,100 C2640,140 2760,140 2880,100 L2880,200 L0,200 Z";

export function PageWave() {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 -z-20 h-[150px] overflow-hidden print:hidden"
        >
            {/* 后层：慢、淡 */}
            <svg
                className="absolute inset-x-0 bottom-0 h-[140px] w-[200%] motion-safe:animate-[wave-drift_26s_linear_infinite]"
                viewBox="0 0 2880 200"
                preserveAspectRatio="none"
            >
                <path d={WAVE_PATH} className="fill-primary/[0.05] dark:fill-primary/[0.1]" />
            </svg>

            {/* 前层：快一点、反向 */}
            <svg
                className="absolute inset-x-0 bottom-0 h-[95px] w-[200%] motion-safe:animate-[wave-drift_17s_linear_infinite] motion-safe:[animation-direction:reverse]"
                viewBox="0 0 2880 200"
                preserveAspectRatio="none"
            >
                <path d={WAVE_PATH} className="fill-primary/[0.08] dark:fill-primary/[0.14]" />
            </svg>
        </div>
    );
}
