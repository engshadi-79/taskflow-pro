import { AnimatedBackground } from "@/components/shared/animated-background";
import { Avatar } from "@/components/shared/avatar";
import { BriefcaseIcon, CalendarIcon, FolderIcon } from "@/components/shared/icons";
import { LiveDateLabel, LiveGreeting, formatDateLabel, greetingFor } from "@/components/dashboard/live-greeting";
import type { Role } from "@/lib/types/roles";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

/** Solid white pill, matching the requested layout's chip style - distinct
 * from HeaderChip's translucent-on-gradient look used elsewhere. */
function SolidChip({
  icon,
  children,
  // padding/text-size are part of the default here (not hardcoded in the
  // base template below) so a caller's override fully replaces them rather
  // than sitting alongside them as a same-specificity Tailwind tie that
  // resolves unpredictably by stylesheet order, not by className order
  sizeClassName = "px-3 py-1.5 text-[12px]",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  sizeClassName?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white font-bold text-primary shadow-sm ${sizeClassName}`}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Rendered on the server, so the greeting and date come from one clock and
 * cannot drift between server and client.
 *
 * Layout (RTL): photo first on the right, the name beside it, the role
 * chip below the photo, and the date (+ department) pinned to the left.
 */
export function WelcomeBanner({
  fullName,
  role,
  departmentName,
  avatarUrl,
}: {
  fullName: string;
  role: Role;
  departmentName?: string | null;
  avatarUrl?: string | null;
}) {
  const now = new Date();
  const firstName = fullName.trim().split(/\s+/)[0];
  const initialGreeting = greetingFor(now.getHours());
  const initialDateLabel = formatDateLabel(now);

  return (
    <section className="banner-violet relative mb-5 overflow-hidden rounded-[20px] px-6 py-7 text-white shadow-lg shadow-accent-600/20">
      <AnimatedBackground intensity="subtle" />

      {/* date (+ department) pinned to the left, opposite the photo, and
          vertically centered on the banner's own height */}
      <div className="relative mb-5 flex flex-col items-start gap-2 sm:absolute sm:end-6 sm:top-1/2 sm:mb-0 sm:-translate-y-1/2">
        {departmentName && (
          <SolidChip icon={<FolderIcon className="h-3.5 w-3.5 text-accent-600" />}>{departmentName}</SolidChip>
        )}
        <SolidChip
          icon={<CalendarIcon className="h-4 w-4 text-accent-600" />}
          sizeClassName="px-3.5 py-2 text-[14px]"
        >
          <LiveDateLabel initial={initialDateLabel} />
        </SolidChip>
      </div>

      <div className="relative flex items-center gap-4">
        {/* photo first (renders at the right edge in RTL), role chip below it */}
        <div className="flex shrink-0 flex-col items-center gap-2.5">
          <div className="relative">
            <Avatar
              src={avatarUrl}
              name={fullName}
              size={104}
              background="rgba(255,255,255,0.15)"
              className="ring-4 ring-white/30"
            />
            <span className="absolute bottom-1.5 end-1.5 h-4 w-4 rounded-full bg-green-500 ring-[3px] ring-white/80" />
          </div>
          <SolidChip icon={<BriefcaseIcon className="h-3.5 w-3.5 text-accent-600" />}>
            {ROLE_LABEL[role]}
          </SolidChip>
        </div>

        {/* name, beside the photo */}
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-white/85">
            <LiveGreeting initial={initialGreeting} /> 👋
          </p>
          <h1 className="mt-1 text-[28px] font-black leading-tight sm:text-[32px]">
            {firstName}
          </h1>
        </div>
      </div>
    </section>
  );
}
