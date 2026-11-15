import { memo } from 'react';

export const SkeletonRows = memo(function SkeletonRows({
  count = 4,
  variant = 'shimmer',
}: {
  count?: number;
  variant?: 'shimmer' | 'sweep';
}) {
  if (variant === 'sweep') {
    return (
      <div aria-label="Loading more tracks" className="touch-pan-y space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="relative flex min-h-[78px] items-center gap-2.5 overflow-hidden rounded-2xl border border-white/[0.08] border-t-white/[0.14] bg-gradient-to-b from-[#1C1C1F] to-[#131315] p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
          >
            <span
              aria-hidden="true"
              className="animate-skeleton-sweep pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
              style={{ animationDelay: `${i * 90}ms` }}
            />
            <div className="h-4 w-5 shrink-0 rounded bg-white/[0.06]" />
            <div className="h-12 w-12 shrink-0 rounded-[10px] bg-white/[0.08]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-3/5 rounded-md bg-white/[0.09]" />
              <div className="h-3 w-2/5 rounded-md bg-white/[0.06]" />
              <div className="h-[15px] w-20 rounded-[4px] bg-white/[0.07]" />
            </div>
            <div className="h-4 w-4 shrink-0 rounded-full bg-white/[0.06]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-label="Loading tracks" className="touch-pan-y space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[78px] items-center gap-2.5 rounded-2xl border border-white/[0.08] border-t-white/[0.14] bg-gradient-to-b from-[#1C1C1F] to-[#131315] p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
        >
          <div className="skeleton-shimmer h-12 w-12 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton-shimmer h-3.5 w-3/5 rounded-md" />
            <div className="skeleton-shimmer h-3 w-2/5 rounded-md" />
            <div className="skeleton-shimmer h-[15px] w-16 rounded-[4px]" />
          </div>
          <div className="skeleton-shimmer h-4 w-4 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
});
