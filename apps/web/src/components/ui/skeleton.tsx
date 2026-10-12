export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-steel-100 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-steel-200/80 bg-white p-5 shadow-card">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-3 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}
