"use client";

import { useState } from "react";
import { addProjectMember, removeProjectMember } from "@/lib/actions/projects";
import { Avatar } from "@/components/shared/avatar";
import type { ProjectMemberWithUser } from "@/lib/types/project";

type EmployeeOption = { id: string; full_name: string };

export function ProjectTeam({
  projectId,
  members,
  employees,
  canManage,
}: {
  projectId: string;
  members: ProjectMemberWithUser[];
  /** Org employees not already on the project - the add dropdown's options. */
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-end gap-3 rounded-[18px] border border-border bg-surface p-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">إضافة عضو</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            >
              <option value="">اختر موظفًا</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const result = await addProjectMember(projectId, selected);
              setPending(false);
              if (result?.error) setError(result.error);
              else setSelected("");
            }}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            إضافة
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {members.map((member) => (
          <MemberRow key={member.id} member={member} projectId={projectId} canManage={canManage} />
        ))}
        {members.length === 0 && (
          <li className="rounded-[18px] border border-border bg-surface p-6 text-center text-muted sm:col-span-2">
            لا يوجد أعضاء بعد
          </li>
        )}
      </ul>
    </div>
  );
}

function MemberRow({
  member,
  projectId,
  canManage,
}: {
  member: ProjectMemberWithUser;
  projectId: string;
  canManage: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (!member.user) return null;

  return (
    <li className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-surface px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar src={member.user.avatar_url} name={member.user.full_name} size={30} decorative />
        <span className="text-sm font-bold text-foreground">{member.user.full_name}</span>
      </div>
      {canManage && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await removeProjectMember(member.id, projectId);
            setBusy(false);
          }}
          className="text-sm text-red-600 hover:underline disabled:opacity-60"
        >
          إزالة
        </button>
      )}
    </li>
  );
}
