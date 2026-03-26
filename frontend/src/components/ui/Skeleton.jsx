export function Skeleton({ className = '' }) {
  return (
    <div className={`shimmer rounded-xl w-full ${className}`} />
  );
}

export function SkeletonRow({ className = '' }) {
  return (
    <div className={`flex items-center gap-4 py-3 ${className}`}>
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`p-6 rounded-2xl bg-surface border border-white/[0.05] space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
      </div>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
