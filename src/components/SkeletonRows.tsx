import { memo } from 'react';

export const SkeletonRows = memo(function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div aria-label="Loading tracks" className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[70px] items-center gap-2.5 rounded-2xl border border-white/[0.08] border-t-white/[0.16] bg-gradient-to-b from-white/[0.065] to-white/[0.02] px-3.5 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
        >
          <div className="skeleton-shimmer h-12 w-12 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton-shimmer h-3.5 w-3/5 rounded-md" />
            <div className="skeleton-shimmer h-3 w-2/5 rounded-md" />
          </div>
          <div className="skeleton-shimmer h-4 w-4 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
});
