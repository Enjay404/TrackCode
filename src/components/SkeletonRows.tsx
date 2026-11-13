export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div aria-label="Loading tracks" className="divide-y divide-white/[0.08]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-[68px] items-center gap-3 px-3.5 py-3">
          <div className="skeleton-shimmer h-12 w-12 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton-shimmer h-3.5 w-3/5 rounded-md" />
            <div className="skeleton-shimmer h-3 w-2/5 rounded-md" />
          </div>
          <div className="skeleton-shimmer h-3.5 w-20 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}
