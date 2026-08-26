"use client";

import { useActionState, useState } from "react";
import { createInvite, revokeInvite, type CreateInviteState, type RevokeInviteState } from "@/lib/actions/invites";

export type InviteRow = {
  id: string;
  role: "employee" | "department_manager";
  department_id: string | null;
  department_name: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string;
  revoked_at: string | null;
};

const ROLE_LABEL: Record<InviteRow["role"], string> = {
  employee: "موظف",
  department_manager: "مدير قسم",
};

const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

const initialCreateState: CreateInviteState = {};
const initialRevokeState: RevokeInviteState = {};

function inviteStatus(invite: InviteRow): "active" | "expired" | "used_up" | "revoked" {
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at) <= new Date()) return "expired";
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) return "used_up";
  return "active";
}

const STATUS_LABEL: Record<ReturnType<typeof inviteStatus>, string> = {
  active: "فعّالة",
  expired: "منتهية",
  used_up: "استُنفدت",
  revoked: "أُلغيت",
};

const STATUS_CLASS: Record<ReturnType<typeof inviteStatus>, string> = {
  active: "bg-green-50 text-green-700",
  expired: "bg-background text-muted",
  used_up: "bg-background text-muted",
  revoked: "bg-red-50 text-red-700",
};

function RevokeButton({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(revokeInvite, initialRevokeState);
  return (
    <form action={formAction}>
      <input type="hidden" name="invite_id" value={inviteId} />
      <button type="submit" disabled={pending} className="text-[12px] font-bold text-red-600 hover:underline disabled:opacity-60">
        {pending ? "جارٍ الإلغاء..." : "إلغاء"}
      </button>
      {state.error && <p className="text-[11px] text-red-600">{state.error}</p>}
    </form>
  );
}

export function InviteManager({
  invites,
  departments,
}: {
  invites: InviteRow[];
  departments: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createInvite, initialCreateState);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.link) return;
    await navigator.clipboard.writeText(state.link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-foreground">دعوات المؤسسة</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-accent-600 px-3.5 py-1.5 text-[12px] font-extrabold text-white hover:bg-accent-700"
        >
          + رابط دعوة جديد
        </button>
      </div>

      {showForm && (
        <form action={formAction} className="mb-4 space-y-2.5 rounded-[12px] border border-border bg-background p-3.5">
          <div className="flex flex-wrap gap-2.5">
            <select name="role" defaultValue="employee" className={`${inputClass} w-auto`}>
              <option value="employee">موظف</option>
              <option value="department_manager">مدير قسم</option>
            </select>
            <select name="department_id" defaultValue="" className={`${inputClass} w-auto`}>
              <option value="">بدون قسم</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              name="expires_in_days"
              defaultValue={7}
              min={1}
              placeholder="صلاحية (أيام)"
              className={`${inputClass} w-32`}
            />
            <input
              type="number"
              name="max_uses"
              min={1}
              placeholder="عدد الاستخدامات (اختياري)"
              className={`${inputClass} w-44`}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[8px] bg-accent-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {pending ? "جارٍ الإنشاء..." : "إنشاء الرابط"}
          </button>
          {state.error && <p className="text-[11.5px] font-bold text-red-600">{state.error}</p>}
          {state.link && (
            <div className="flex items-center gap-2 rounded-[8px] bg-green-50 p-2.5">
              <code className="flex-1 truncate text-[11.5px] text-green-800" dir="ltr">
                {state.link}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-green-700"
              >
                {copied ? "تم النسخ" : "نسخ الرابط"}
              </button>
            </div>
          )}
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-right text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-extrabold uppercase tracking-wide text-faint">
              <th className="px-3 py-2">الدور</th>
              <th className="px-3 py-2">القسم</th>
              <th className="px-3 py-2">الاستخدام</th>
              <th className="px-3 py-2">الصلاحية حتى</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <tr key={invite.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-bold text-foreground">{ROLE_LABEL[invite.role]}</td>
                  <td className="px-3 py-2 text-muted">{invite.department_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">
                    {invite.use_count}
                    {invite.max_uses !== null ? ` / ${invite.max_uses}` : " / بلا حد"}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {new Date(invite.expires_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASS[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">{status === "active" && <RevokeButton inviteId={invite.id} />}</td>
                </tr>
              );
            })}
            {invites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-muted">
                  لا توجد دعوات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
