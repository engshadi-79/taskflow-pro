/**
 * Generic instant-paint placeholder for every /m/* route. Next.js shows
 * this immediately on navigation (via each route's loading.tsx) while the
 * real server component's data fetch is still in flight - without it, a
 * slow query means a frozen blank screen with zero feedback, which reads
 * as "the app is slow/unresponsive" even when the tap itself registered
 * instantly.
 */
export function MobileSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse px-4 pt-4">
      <div className="mb-4 h-6 w-32 rounded-full bg-border" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 rounded-[14px] bg-border/60" />
        ))}
      </div>
    </div>
  );
}
