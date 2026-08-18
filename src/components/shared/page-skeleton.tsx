/** Generic instant-feedback skeleton shown by a route's loading.tsx while its
 * server-rendered data is still being fetched, so navigation feels immediate
 * instead of leaving the previous page frozen until everything resolves. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4.5">
      <div className="h-24 rounded-[20px] bg-surface" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-[16px] bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-[18px] bg-surface" />
        ))}
      </div>
      <div className="h-64 rounded-[18px] bg-surface" />
    </div>
  );
}
