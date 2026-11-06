/**
 * 路由切换时的统一过渡：只在支持动效的偏好下淡入上移，
 * 避免每次跳页都硬切；打印与前庭敏感用户不受影响。
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
            {children}
        </div>
    );
}
