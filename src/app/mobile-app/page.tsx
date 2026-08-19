import type { Metadata } from "next";
import Link from "next/link";

// This page exists purely as an always-reachable (no auth redirect) entry
// point that carries the /m-scoped manifest link tag, for tools like
// PWABuilder to crawl. /m itself can't serve this job: it's auth-gated
// (src/app/m/layout.tsx), so an unauthenticated crawler hitting it gets
// redirected to /login before any HTML/metadata is ever sent, and picks up
// the desktop dashboard's manifest.json (start_url "/dashboard") instead.
// The packaged app's actual start_url still comes from manifest-mobile.json
// ("/m"), regardless of this page's own URL.
export const metadata: Metadata = {
  title: "منجز - تطبيق الجوال",
  manifest: "/manifest-mobile.json",
};

export default function MobileAppLandingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#7c72ea] to-[#4f46c9] px-6 text-center text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-white/15 text-2xl font-black">م</span>
      <div>
        <h1 className="text-[20px] font-black">منجز - تطبيق الجوال</h1>
        <p className="mt-2 text-[13px] font-semibold text-white/80">المهام والمشاريع والفريق من جوالك</p>
      </div>
      <Link href="/m" className="rounded-full bg-white px-6 py-3 text-[13.5px] font-extrabold text-[#4f46c9]">
        فتح التطبيق
      </Link>
    </div>
  );
}
