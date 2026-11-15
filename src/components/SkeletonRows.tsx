import { Fragment, memo } from 'react';

export const SkeletonRows = memo(function SkeletonRows({
  count = 4,
}: {
  count?: number;
  variant?: 'shimmer' | 'sweep';
}) {
  return (
    <div
      aria-label="Loading tracks"
      className="overflow-hidden rounded-[20px] border border-white/[0.08] border-t-white/[0.15] bg-[#1C1C1E] shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Fragment key={i}>
          {i > 0 && <div aria-hidden="true" className="ml-[78px] mr-4 h-px scale-y-50 bg-white/[0.08]" />}
          <div className="flex items-center gap-3.5 px-3.5 py-2.5">
            <div className="skeleton-shimmer h-[52px] w-[52px] shrink-0 rounded-[11px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton-shimmer h-3.5 w-3/5 rounded-md" />
              <div className="skeleton-shimmer h-3 w-2/5 rounded-md" />
            </div>
            <div className="skeleton-shimmer h-3.5 w-3.5 shrink-0 rounded-full" />
          </div>
        </Fragment>
      ))}
    </div>
  );
});
