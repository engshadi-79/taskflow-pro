import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { MobileHeader } from "@/components/mobile/mobile-header";

const ITEMS: { key: string; href: string; label: string; tint: string; icon: string; managerOnly?: boolean }[] = [
  { key: "calendar", href: "/m/calendar", label: "التقويم", tint: "bg-purple-50", icon: "📅" },
  { key: "projects", href: "/m/projects", label: "المشاريع", tint: "bg-pink-50", icon: "💼" },
  { key: "workload", href: "/m/workload", label: "الحمل الوظيفي", tint: "bg-accent-50", icon: "📊", managerOnly: true },
  { key: "meetings", href: "/m/meetings", label: "الاجتماعات", tint: "bg-orange-50", icon: "🗓" },
  { key: "chat", href: "/m/chat", label: "المحادثات", tint: "bg-teal-50", icon: "💬" },
  { key: "requests", href: "/m/requests", label: "الطلبات والموافقات", tint: "bg-green-50", icon: "✅" },
  { key: "reports", href: "/m/reports", label: "التقارير والأداء", tint: "bg-brand-blue-50", icon: "📈" },
  { key: "profile", href: "/m/profile", label: "الملف الشخصي", tint: "bg-accent-50", icon: "👤" },
  { key: "settings", href: "/m/settings", label: "الإعدادات", tint: "bg-background", icon: "⚙️" },
];

export default async function MobileMorePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const isManagerRole = profile.role !== "employee";

  return (
    <div>
      <MobileHeader title="المزيد" />
      <div className="grid grid-cols-3 gap-3 px-4 pb-6">
        {ITEMS.filter((item) => !item.managerOnly || isManagerRole).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-[16px] bg-surface p-4 text-center shadow-[0_4px_12px_rgba(30,41,59,.06)]"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-[13px] text-[20px] ${item.tint}`}>{item.icon}</span>
            <span className="text-[11.5px] font-bold text-foreground">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
