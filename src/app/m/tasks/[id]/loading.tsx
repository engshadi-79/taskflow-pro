import { MobileSkeleton } from "@/components/mobile/mobile-skeleton";

export default function Loading() {
  return (
    <div>
      <div className="h-[130px] animate-pulse bg-border/40" />
      <MobileSkeleton rows={4} />
    </div>
  );
}
