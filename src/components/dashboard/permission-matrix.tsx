"use client";

import { useState } from "react";
import { toggleRolePermission } from "@/lib/actions/permissions";
import { LockIcon } from "@/components/shared/icons";

type PermissionRow = { key: string; label: string; category: string };
type RolePermissionRow = { role: string; permission_key: string; scope: string };

const CATEGORY_LABEL: Record<string, string> = {
  tasks: "المهام",
  employees: "الموظفون",
  projects: "المشاريع",
  reports: "التقارير",
  requests: "الطلبات",
  workflows: "سير العمل",
  automation: "الأتمتة",
  sla: "SLA",
  notifications: "الإشعارات",
  organization: "المؤسسة",
};

const EDITABLE_ROLES = ["department_manager", "employee"] as const;
const ROLE_LABEL: Record<string, string> = {
  super_admin: "مدير عام",
  department_manager: "مدير قسم",
  employee: "موظف",
};

export function PermissionMatrix({
  permissions,
  rolePermissions,
}: {
  permissions: PermissionRow[];
  rolePermissions: RolePermissionRow[];
}) {
  // key = `${role}:${permission_key}` -> true if granted
  const [grants, setGrants] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const rp of rolePermissions) map[`${rp.role}:${rp.permission_key}`] = true;
    return map;
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byCategory = permissions.reduce<Record<string, PermissionRow[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  async function handleToggle(role: (typeof EDITABLE_ROLES)[number], permissionKey: string) {
    const mapKey = `${role}:${permissionKey}`;
    const nextEnabled = !grants[mapKey];
    setError(null);
    setPendingKey(mapKey);
    setGrants((prev) => ({ ...prev, [mapKey]: nextEnabled }));

    const result = await toggleRolePermission(role, permissionKey, nextEnabled, "organization");
    setPendingKey(null);

    if (result?.error) {
      // roll back the optimistic flip
      setGrants((prev) => ({ ...prev, [mapKey]: !nextEnabled }));
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {Object.entries(byCategory).map(([category, perms]) => (
        <div key={category} className="overflow-hidden rounded-[18px] border border-border bg-surface">
          <div className="border-b border-border bg-background px-4 py-2.5 text-[13px] font-extrabold text-foreground">
            {CATEGORY_LABEL[category] ?? category}
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-faint">
              <tr>
                <th className="px-4 py-2 text-start">الصلاحية</th>
                <th className="w-24 px-2 py-2 text-center">
                  <span className="inline-flex items-center gap-1">
                    <LockIcon className="h-3 w-3" />
                    {ROLE_LABEL.super_admin}
                  </span>
                </th>
                {EDITABLE_ROLES.map((role) => (
                  <th key={role} className="w-24 px-2 py-2 text-center">
                    {ROLE_LABEL[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map((perm) => (
                <tr key={perm.key} className="border-t border-border">
                  <td className="px-4 py-2.5 text-foreground">{perm.label}</td>
                  <td className="px-2 py-2.5 text-center">
                    <input type="checkbox" checked disabled aria-label={`${perm.label} - مدير عام (دائم)`} />
                  </td>
                  {EDITABLE_ROLES.map((role) => {
                    const mapKey = `${role}:${perm.key}`;
                    return (
                      <td key={role} className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!grants[mapKey]}
                          disabled={pendingKey === mapKey}
                          onChange={() => handleToggle(role, perm.key)}
                          aria-label={`${perm.label} - ${ROLE_LABEL[role]}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
