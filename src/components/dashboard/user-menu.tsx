"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  changeEmail,
  changePassword,
  signOut,
  type ChangeEmailState,
  type ChangePasswordState,
} from "@/lib/actions/auth";
import { Modal } from "@/components/shared/modal";
import { SidePanel } from "@/components/shared/side-panel";
import { Avatar } from "@/components/shared/avatar";
import { useSystemNotifications } from "@/lib/hooks/use-system-notifications";
import { NotificationPreferencesSettings } from "@/components/dashboard/notification-preferences-settings";
import {
  BellIcon,
  ChevronDownIcon,
  GearIcon,
  InfoIcon,
  KeyIcon,
  LogoutIcon,
  MailIcon,
  UserIcon,
} from "@/components/shared/icons";
import type { Role } from "@/lib/types/roles";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

const ROLE_SCOPE: Record<Role, string> = {
  super_admin: "وصول كامل إلى كل الأقسام والمهام والموظفين.",
  department_manager: "إدارة مهام قسمك، وعرض أعضائه دون تعديلهم.",
  employee: "عرض وتحديث المهام المسندة إليك.",
};

type Theme = "light" | "dark" | "system";

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "فاتح" },
  { value: "dark", label: "داكن" },
  { value: "system", label: "حسب النظام" },
];

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", theme);
}

const inputClass =
  "w-full rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function UserMenu({
  fullName,
  role,
  jobTitle,
  avatarUrl,
  currentEmail,
}: {
  fullName: string;
  role: Role;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  currentEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<
    "password" | "email" | "settings" | "notifications" | "about" | null
  >(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(next: typeof dialog) {
    setOpen(false);
    setDialog(next);
  }

  /** The menu item that opened the dialog is gone by the time it closes, so
   *  send focus back to the trigger rather than letting it fall to <body>. */
  function closeDialog() {
    setDialog(null);
    triggerRef.current?.focus();
  }

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          // the name/role text is hidden below `sm`, so the button needs an
          // explicit name rather than relying on its contents
          aria-label={`قائمة المستخدم: ${fullName}`}
          className="flex items-center gap-2.5 rounded-full border border-border bg-background py-1.5 pe-1.5 ps-3 transition-colors hover:border-accent-300"
        >
          <ChevronDownIcon
            className={`hidden h-4 w-4 text-faint transition-transform sm:block ${
              open ? "rotate-180" : ""
            }`}
          />
          <span className="hidden text-end leading-tight sm:block">
            <span className="block text-[13px] font-extrabold text-foreground">
              {fullName}
            </span>
            <span className="block text-[11px] font-medium text-muted">
              {jobTitle || ROLE_LABEL[role]}
            </span>
          </span>
          <Avatar src={avatarUrl} name={fullName} size={36} className="text-xs" decorative />
        </button>

        {open && (
          <div
            role="menu"
            aria-label="قائمة المستخدم"
            className="fixed inset-x-4 top-[80px] z-40 mx-auto max-w-[264px] overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl shadow-black/20 sm:absolute sm:inset-x-auto sm:end-0 sm:top-[calc(100%+10px)] sm:mx-0 sm:w-[min(88vw,264px)]"
          >
            <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-5 text-center">
              <Avatar
                src={avatarUrl}
                name={fullName}
                size={80}
                className="text-2xl ring-4 ring-accent-100"
                decorative
              />
              <span className="mt-1 text-[15px] font-black text-foreground">
                {fullName}
              </span>
              <span className="text-[12px] font-medium text-muted">
                {jobTitle || ROLE_LABEL[role]}
              </span>
            </div>

            <div className="border-t border-border py-1.5">
              <MenuLink
                href="/dashboard/profile"
                onNavigate={() => setOpen(false)}
                tint="bg-accent-50 text-accent-600"
                icon={<UserIcon className="h-[17px] w-[17px]" />}
              >
                الملف الشخصي
              </MenuLink>
              <MenuButton
                onClick={() => pick("password")}
                tint="bg-orange-50 text-orange-600"
                icon={<KeyIcon className="h-[17px] w-[17px]" />}
              >
                تغيير كلمة المرور
              </MenuButton>
              <MenuButton
                onClick={() => pick("email")}
                tint="bg-teal-50 text-teal-600"
                icon={<MailIcon className="h-[17px] w-[17px]" />}
              >
                تغيير البريد الإلكتروني
              </MenuButton>
              <MenuButton
                onClick={() => pick("settings")}
                tint="bg-background text-muted"
                icon={<GearIcon className="h-[17px] w-[17px]" />}
              >
                إعدادات الحساب
              </MenuButton>
              <MenuButton
                onClick={() => pick("notifications")}
                tint="bg-accent-50 text-accent-600"
                icon={<BellIcon className="h-[17px] w-[17px]" />}
              >
                تفضيلات الإشعارات
              </MenuButton>
              <MenuButton
                onClick={() => pick("about")}
                tint="bg-purple-50 text-purple-500"
                icon={<InfoIcon className="h-[17px] w-[17px]" />}
              >
                حول النظام
              </MenuButton>
            </div>

            <form action={signOut} className="border-t border-border py-1.5">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-[13.5px] font-bold text-brand-red-500 transition-colors hover:bg-brand-red-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-red-50 text-brand-red-500">
                  <LogoutIcon className="h-[17px] w-[17px]" />
                </span>
                تسجيل خروج
              </button>
            </form>
          </div>
        )}
      </div>

      {dialog === "password" && <ChangePasswordDialog onClose={closeDialog} />}
      {dialog === "email" && (
        <ChangeEmailDialog onClose={closeDialog} currentEmail={currentEmail} />
      )}
      {dialog === "settings" && <SettingsDialog onClose={closeDialog} />}
      {dialog === "notifications" && (
        <SidePanel
          title="تفضيلات الإشعارات"
          subtitle="أنواع الإشعارات، عدم الإزعاج، والملخص اليومي"
          onClose={closeDialog}
        >
          <NotificationPreferencesSettings role={role} />
        </SidePanel>
      )}
      {dialog === "about" && (
        <AboutDialog role={role} fullName={fullName} onClose={closeDialog} />
      )}
    </>
  );
}

const rowClass =
  "flex w-full items-center gap-3 px-4 py-2.5 text-[13.5px] font-bold text-foreground transition-colors hover:bg-background";

function MenuLink({
  href,
  onNavigate,
  tint,
  icon,
  children,
}: {
  href: string;
  onNavigate: () => void;
  tint: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} role="menuitem" onClick={onNavigate} className={rowClass}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${tint}`}
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}

function MenuButton({
  onClick,
  tint,
  icon,
  children,
}: {
  onClick: () => void;
  tint: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={rowClass}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${tint}`}
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<
    ChangePasswordState,
    FormData
  >(changePassword, {});

  return (
    <Modal
      title="تغيير كلمة المرور"
      subtitle="أدخل كلمة المرور الحالية ثم الجديدة"
      onClose={onClose}
    >
      {state.success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-bold text-green-600">
            تم تغيير كلمة المرور بنجاح
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700"
          >
            إغلاق
          </button>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="current_password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              كلمة المرور الحالية
            </label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="new_password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              كلمة المرور الجديدة
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
            <p className="mt-1 text-[11.5px] text-muted">8 أحرف على الأقل</p>
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {state.error && (
            <p className="text-sm font-medium text-brand-red-500" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {pending ? "جارٍ الحفظ..." : "حفظ"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-border px-5 py-2.5 text-sm font-bold text-muted hover:bg-background"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ChangeEmailDialog({
  onClose,
  currentEmail,
}: {
  onClose: () => void;
  currentEmail: string;
}) {
  const [state, formAction, pending] = useActionState<ChangeEmailState, FormData>(
    changeEmail,
    {}
  );

  return (
    <Modal
      title="تغيير البريد الإلكتروني"
      subtitle={`البريد الحالي: ${currentEmail}`}
      onClose={onClose}
    >
      {state.success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-bold text-green-600">
            أرسلنا رابط تأكيد إلى البريد الجديد، ورابطًا آخر إلى بريدك الحالي
            كإجراء أمان. افتح الرسالتين واضغط رابط التأكيد في كل منهما لإتمام
            التغيير.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700"
          >
            إغلاق
          </button>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="new_email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              البريد الإلكتروني الجديد
            </label>
            <input
              id="new_email"
              name="new_email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="current_password_for_email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              كلمة المرور الحالية
            </label>
            <input
              id="current_password_for_email"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
            <p className="mt-1 text-[11.5px] text-muted">للتأكيد على هويتك</p>
          </div>

          {state.error && (
            <p className="text-sm font-medium text-brand-red-500" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {pending ? "جارٍ الإرسال..." : "إرسال روابط التأكيد"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-border px-5 py-2.5 text-sm font-bold text-muted hover:bg-background"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  // this dialog only mounts on click, well after hydration, so reading
  // localStorage in the initialiser cannot cause an SSR mismatch
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    return stored === "dark" || stored === "system" ? stored : "light";
  });

  // keep following the OS while 'system' is selected
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <Modal
      title="إعدادات الحساب"
      subtitle="تفضيلات العرض على هذا الجهاز"
      onClose={onClose}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-bold text-foreground">
          مظهر الواجهة
        </legend>
        {THEMES.map((t) => (
          <label
            key={t.value}
            className={`flex cursor-pointer items-center justify-between rounded-[10px] border px-3.5 py-2.5 text-sm font-bold transition-colors ${
              theme === t.value
                ? "border-accent-500 bg-accent-50 text-accent-700"
                : "border-border text-foreground hover:bg-background"
            }`}
          >
            {t.label}
            <input
              type="radio"
              name="theme"
              value={t.value}
              checked={theme === t.value}
              onChange={() => {
                setTheme(t.value);
                applyTheme(t.value);
              }}
              className="h-4 w-4 accent-current"
            />
          </label>
        ))}
      </fieldset>

      <SystemNotificationSettings />

      <p className="mt-3 text-[11.5px] leading-5 text-muted">
        تُحفظ هذه التفضيلات في هذا المتصفح فقط، ولا تتغيّر لبقية المستخدمين.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700"
      >
        تم
      </button>
    </Modal>
  );
}

function SystemNotificationSettings() {
  const {
    supported,
    permission,
    prefs,
    active,
    setEnabled,
    setOnlyWhenHidden,
    setSound,
    showNotification,
  } = useSystemNotifications();
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState<string | null>(null);

  return (
    <section className="mt-6 border-t border-border pt-5">
      <h3 className="mb-1 text-sm font-bold text-foreground">إشعارات النظام</h3>
      <p className="mb-3 text-[11.5px] leading-5 text-muted">
        تظهر كإشعارات ويندوز خارج المتصفح، بالتوازي مع إشعارات التطبيق.
      </p>

      {!supported && (
        <p className="rounded-[10px] bg-background px-3.5 py-3 text-[12px] leading-5 text-muted">
          هذا المتصفح لا يدعم إشعارات النظام. إشعارات التطبيق تعمل كما هي.
        </p>
      )}

      {supported && (
        <>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 text-sm font-bold text-foreground hover:bg-background">
            تفعيل إشعارات النظام
            <input
              type="checkbox"
              checked={prefs.enabled && permission === "granted"}
              disabled={busy || permission === "denied"}
              onChange={async (e) => {
                setBusy(true);
                setTested(null);
                await setEnabled(e.target.checked);
                setBusy(false);
              }}
              className="h-4 w-4 accent-accent-600"
            />
          </label>

          {permission === "denied" && (
            // The browser will not re-prompt once blocked, so the only way out
            // is the site settings panel. Spell out where it is.
            <div className="mt-2 rounded-[10px] bg-brand-red-50 px-3.5 py-3 text-[12px] leading-5 text-foreground">
              <p className="font-bold text-brand-red-500">
                الإشعارات محجوبة من إعدادات المتصفح
              </p>
              <p className="mt-1 text-muted">
                لن يسألك المتصفح مرة أخرى بعد الحجب. لتفعيلها: اضغط أيقونة القفل
                🔒 بجانب عنوان الموقع ← الإشعارات ← اختر «السماح»، ثم أعد تحميل
                الصفحة.
              </p>
            </div>
          )}

          <fieldset
            disabled={!active}
            className="mt-2 space-y-2 disabled:opacity-50"
          >
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 text-[13px] font-bold text-foreground hover:bg-background">
              <span>
                فقط عندما يكون التطبيق في الخلفية
                <span className="mt-0.5 block text-[11px] font-medium text-muted">
                  يمنع تكرار الإشعار وأنت تنظر إلى الصفحة
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs.onlyWhenHidden}
                onChange={(e) => setOnlyWhenHidden(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent-600"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 text-[13px] font-bold text-foreground hover:bg-background">
              نبرة صوتية مع الإشعار
              <input
                type="checkbox"
                checked={prefs.sound}
                onChange={(e) => setSound(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent-600"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                const result = showNotification("منجز", {
                  body: "هذا إشعار تجريبي للتأكد من عمل إشعارات النظام.",
                  tag: "monjez-test",
                  url: "/dashboard/notifications",
                  force: true, // a test is useless if the focused tab swallows it
                });
                setTested(
                  result === "shown"
                    ? "تم إرسال إشعار تجريبي."
                    : "تعذّر إظهار الإشعار التجريبي."
                );
              }}
              className="w-full rounded-[10px] border border-accent-300 py-2 text-[13px] font-extrabold text-accent-700 hover:bg-accent-50"
            >
              إرسال إشعار تجريبي
            </button>
          </fieldset>

          {tested && (
            <p className="mt-2 text-[11.5px] text-muted" role="status">
              {tested}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AboutDialog({
  role,
  fullName,
  onClose,
}: {
  role: Role;
  fullName: string;
  onClose: () => void;
}) {
  return (
    <Modal title="حول النظام" subtitle="منجز — إدارة المهام والموظفين" onClose={onClose}>
      <dl className="divide-y divide-border text-sm">
        <Row label="المستخدم" value={fullName} />
        <Row label="الدور" value={ROLE_LABEL[role]} />
        <Row label="نطاق صلاحياتك" value={ROLE_SCOPE[role]} />
        <Row label="اللغة" value="العربية (RTL)" />
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/dashboard/notifications"
          onClick={onClose}
          className="rounded-[10px] border border-border py-2.5 text-center text-sm font-bold text-foreground hover:bg-background"
        >
          مركز الإشعارات
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[10px] bg-accent-600 py-2.5 text-sm font-extrabold text-white hover:bg-accent-700"
        >
          إغلاق
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 font-bold text-muted">{label}</dt>
      <dd className="text-end text-foreground">{value}</dd>
    </div>
  );
}
