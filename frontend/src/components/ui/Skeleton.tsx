interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-800 ${className}`} />
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function StatCardSkeleton({ count = 1 }: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </>
  );
}

export function ChartSkeleton() {
  return (
    <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function WorkoutSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
