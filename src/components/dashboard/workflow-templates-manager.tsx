"use client";

import { useActionState, useState } from "react";
import {
  createWorkflowTemplate,
  toggleWorkflowTemplateActive,
  addWorkflowStep,
  deleteWorkflowStep,
  type WorkflowFormState,
} from "@/lib/actions/workflow";
import { PageHeader } from "@/components/shared/page-header";
import { GearIcon } from "@/components/shared/icons";
import { APPROVER_TYPE_LABEL, type ApproverType, type WorkflowStep, type WorkflowTemplate } from "@/lib/types/workflow";

const initialState: WorkflowFormState = {};
const inputClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

type EmployeeOption = { id: string; full_name: string };

export function WorkflowTemplatesManager({
  templates,
  stepsByTemplate,
  employees,
}: {
  templates: WorkflowTemplate[];
  stepsByTemplate: Record<string, WorkflowStep[]>;
  employees: EmployeeOption[];
}) {
  const [createState, createAction, creating] = useActionState(createWorkflowTemplate, initialState);

  return (
    <div className="space-y-6">
      <PageHeader
        title="أنواع الطلبات (Workflow)"
        subtitle="محرك موافقات عام - خطوات كل نوع طلب وتسلسل المسؤولين عنها"
        variant="navy"
        icon={<GearIcon className="h-6 w-6" />}
        count={`${templates.length} نوع`}
      />

      <form
        action={createAction}
        className="flex flex-wrap items-end gap-3 rounded-[18px] border border-border bg-surface p-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">اسم نوع الطلب</span>
          <input name="name" required placeholder="مثال: طلب إجازة" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الوصف</span>
          <input name="description" className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          إضافة نوع
        </button>
        {createState?.error && <p className="text-sm text-red-600">{createState.error}</p>}
      </form>

      <div className="space-y-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            steps={stepsByTemplate[template.id] ?? []}
            employees={employees}
          />
        ))}
        {templates.length === 0 && (
          <p className="rounded-[18px] border border-border bg-surface p-6 text-center text-muted">
            لا توجد أنواع طلبات بعد
          </p>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  steps,
  employees,
}: {
  template: WorkflowTemplate;
  steps: WorkflowStep[];
  employees: EmployeeOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [stepState, stepAction, addingStep] = useActionState(addWorkflowStep, initialState);
  const [approverType, setApproverType] = useState<ApproverType>("department_manager");

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-[16px] text-foreground">{template.name}</h3>
          {template.description && <p className="text-[12.5px] text-muted">{template.description}</p>}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await toggleWorkflowTemplateActive(template.id, !template.is_active);
            setBusy(false);
          }}
          className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-60 ${
            template.is_active ? "bg-green-50 text-green-600" : "bg-border text-muted"
          }`}
        >
          {template.is_active ? "نشط" : "معطّل"}
        </button>
      </div>

      <ol className="mb-3 space-y-1.5">
        {steps
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((step) => (
            <li
              key={step.id}
              className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
            >
              <span className="text-foreground">
                {step.position}. {step.name}
              </span>
              <span className="text-[12px] text-muted">
                {APPROVER_TYPE_LABEL[step.approver_type]}
                {step.approver_type === "specific_user" &&
                  ` — ${employees.find((e) => e.id === step.specific_user_id)?.full_name ?? "—"}`}
              </span>
              <DeleteStepButton id={step.id} />
            </li>
          ))}
        {steps.length === 0 && <p className="text-sm text-muted">لا توجد خطوات بعد</p>}
      </ol>

      <form action={stepAction} className="flex flex-wrap items-end gap-2.5 border-t border-border pt-3">
        <input type="hidden" name="template_id" value={template.id} />
        <input
          type="number"
          name="position"
          min="1"
          defaultValue={steps.length + 1}
          placeholder="الترتيب"
          className={`${inputClass} w-20`}
        />
        <input name="name" placeholder="اسم الخطوة" required className={inputClass} />
        <select
          name="approver_type"
          value={approverType}
          onChange={(e) => setApproverType(e.target.value as ApproverType)}
          className={inputClass}
        >
          {(Object.keys(APPROVER_TYPE_LABEL) as ApproverType[]).map((type) => (
            <option key={type} value={type}>
              {APPROVER_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
        {approverType === "specific_user" && (
          <select name="specific_user_id" defaultValue="" required className={inputClass}>
            <option value="" disabled>
              اختر موظفًا
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={addingStep}
          className="rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          إضافة خطوة
        </button>
        {stepState?.error && <p className="text-sm text-red-600">{stepState.error}</p>}
      </form>
    </div>
  );
}

function DeleteStepButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("حذف هذه الخطوة؟")) return;
        setPending(true);
        await deleteWorkflowStep(id);
        setPending(false);
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      حذف
    </button>
  );
}
