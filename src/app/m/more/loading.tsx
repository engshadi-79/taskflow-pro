export default function Loading() {
  return (
    <div className="grid animate-pulse grid-cols-3 gap-3 px-4 pt-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="h-24 rounded-[16px] bg-border/60" />
      ))}
    </div>
  );
}
