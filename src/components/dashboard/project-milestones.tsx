"use client";

import { useActionState, useState } from "react";
import {
  createMilestone,
  updateMilestoneStatus,
  deleteMilestone,
  type ProjectFormState,
} from "@/lib/actions/projects";
import { MILESTONE_STATUS_LABEL, type MilestoneStatus, type ProjectMilestone } from "@/lib/types/project";

const initialState: ProjectFormState = {};

const STATUS_BADGE: Record<MilestoneStatus, string> = {
  pending: "bg-border text-muted",
  in_progress: "bg-accent-50 text-accent-700",
  completed: "bg-green-50 text-green-600",
};

export function ProjectMilestones({
  projectId,
  milestones,
  canManage,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(createMilestone, initialState);

  return (
    <div className="space-y-4">
      {canManage && (
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-3 rounded-[18px] border border-border bg-surface p-4"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان المرحلة</span>
            <input
              name="title"
              required
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الموعد</span>
            <input
              type="date"
              name="due_date"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            إضافة مرحلة
          </button>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        </form>
      )}

      <ul className="space-y-2">
        {milestones.map((milestone) => (
          <MilestoneRow
            key={milestone.id}
            milestone={milestone}
            projectId={projectId}
            canManage={canManage}
          />
        ))}
        {milestones.length === 0 && (
          <li className="rounded-[18px] border border-border bg-surface p-6 text-center text-muted">
            لا توجد مراحل بعد
          </li>
        )}
      </ul>
    </div>
  );
}

function MilestoneRow({
  milestone,
  projectId,
  canManage,
}: {
  milestone: ProjectMilestone;
  projectId: string;
  canManage: boolean;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-bold text-foreground">{milestone.title}</p>
        <p className="text-[12px] text-muted">{milestone.due_date ?? "بلا موعد"}</p>
      </div>
      <div className="flex items-center gap-2.5">
        {canManage ? (
          <select
            defaultValue={milestone.status}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              await updateMilestoneStatus(milestone.id, projectId, e.target.value as MilestoneStatus);
              setBusy(false);
            }}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500"
          >
            {(Object.keys(MILESTONE_STATUS_LABEL) as MilestoneStatus[]).map((status) => (
              <option key={status} value={status}>
                {MILESTONE_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${STATUS_BADGE[milestone.status]}`}>
            {MILESTONE_STATUS_LABEL[milestone.status]}
          </span>
        )}
        {canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm("حذف هذه المرحلة؟")) return;
              setBusy(true);
              await deleteMilestone(milestone.id, projectId);
              setBusy(false);
            }}
            className="text-sm text-red-600 hover:underline disabled:opacity-60"
          >
            حذف
          </button>
        )}
      </div>
    </li>
  );
}
