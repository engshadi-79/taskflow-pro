import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { signOut } from "@/lib/actions/auth";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function MobileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div>
      <MobileHeader title="الإعدادات" back />
      <div className="flex flex-col gap-5 px-4 pb-6">
        <div>
          <div className="mb-2.5 text-[12px] font-extrabold text-faint">التفضيلات العامة</div>
          <div className="flex items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.05)]">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-accent-50 text-accent-600">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            </span>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-foreground">الوضع الداكن</div>
              <div className="mt-0.5 text-[11px] font-semibold text-faint">تفعيل المظهر الداكن للتطبيق</div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-[12px] font-extrabold text-faint">أخرى</div>
          <a
            href="/dashboard/settings"
            className="block rounded-[14px] bg-surface p-3.5 text-[13px] font-bold text-foreground shadow-[0_4px_12px_rgba(30,41,59,.05)]"
          >
            إعدادات إضافية (الإشعارات، الحساب، الخطة)
          </a>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.05)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            <span className="text-[13.5px] font-extrabold text-brand-red-600">تسجيل الخروج</span>
          </button>
        </form>
      </div>
    </div>
  );
}
