import { AnimatedBackground } from "@/components/shared/animated-background";
import { HeaderChip } from "@/components/shared/page-header";
import type { Role } from "@/lib/types/roles";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

function greeting(hour: number) {
  if (hour < 12) return "صباح الخير";
  return "مساء الخير";
}

/**
 * Rendered on the server, so the greeting and date come from one clock and
 * cannot drift between server and client.
 */
export function WelcomeBanner({
  fullName,
  role,
  departmentName,
}: {
  fullName: string;
  role: Role;
  departmentName?: string | null;
}) {
  const now = new Date();
  const firstName = fullName.trim().split(/\s+/)[0];
  const dateLabel = new Intl.DateTimeFormat("ar", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <section className="banner-violet relative mb-5 overflow-hidden rounded-[20px] px-6 py-7 text-white shadow-lg shadow-accent-600/20">
      <AnimatedBackground intensity="subtle" />

      <div className="relative flex flex-wrap-reverse items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-white/85">
            {greeting(now.getHours())} 👋
          </p>
          <h1 className="mt-1 text-[28px] font-black leading-tight sm:text-[32px]">
            {firstName}
          </h1>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <HeaderChip>{ROLE_LABEL[role]}</HeaderChip>
            {departmentName && <HeaderChip>{departmentName}</HeaderChip>}
            <HeaderChip>{dateLabel}</HeaderChip>
          </div>
        </div>

        {/* avatar medallion with a glowing ring and presence dot */}
        <div className="relative shrink-0">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/30 backdrop-blur-sm sm:h-28 sm:w-28">
            <span className="text-4xl font-black sm:text-5xl">
              {firstName[0]}
            </span>
          </div>
          <span className="absolute bottom-1.5 end-1.5 h-4 w-4 rounded-full bg-green-500 ring-[3px] ring-white/80" />
        </div>
      </div>
    </section>
  );
}
