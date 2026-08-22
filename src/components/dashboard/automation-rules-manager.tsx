"use client";

import { useActionState, useState } from "react";
import {
  createAutomationRule,
  toggleAutomationRuleActive,
  deleteAutomationRule,
  applyAutomationRuleTemplate,
  type AutomationFormState,
} from "@/lib/actions/automation";
import { PageHeader } from "@/components/shared/page-header";
import { BoardIcon } from "@/components/shared/icons";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/types/task";
import {
  ACTION_LABEL,
  TRIGGER_LABEL,
  type AutomationAction,
  type AutomationExecution,
  type AutomationRule,
  type AutomationRuleTemplate,
  type AutomationTrigger,
} from "@/lib/types/automation";

const initialState: AutomationFormState = {};
const inputClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

type EmployeeOption = { id: string; full_name: string };

const NEEDS_USER: AutomationAction[] = ["notify_specific_user", "reassign"];

export function AutomationRulesManager({
  rules,
  executions,
  employees,
  templates,
}: {
  rules: AutomationRule[];
  executions: AutomationExecution[];
  employees: EmployeeOption[];
  templates: AutomationRuleTemplate[];
}) {
  const [createState, createAction, creating] = useActionState(createAutomationRule, initialState);
  const [actionType, setActionType] = useState<AutomationAction>("notify_assignee");

  const executionsByRule: Record<string, AutomationExecution[]> = {};
  for (const exec of executions) {
    executionsByRule[exec.rule_id] = [...(executionsByRule[exec.rule_id] ?? []), exec];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأتمتة (Automation)"
        subtitle="Trigger → Condition → Action - إجراءات تلقائية تعمل من الخادم فقط"
        variant="teal"
        icon={<BoardIcon className="h-6 w-6" />}
        count={`${rules.length} قاعدة`}
      />

      {templates.length > 0 && (
        <div className="rounded-[18px] border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-extrabold text-foreground">قوالب جاهزة</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </div>
      )}

      <form
        action={createAction}
        className="grid grid-cols-1 gap-3 rounded-[18px] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">اسم القاعدة</span>
          <input name="name" required className={`${inputClass} w-full`} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">عند (Trigger)</span>
          <select name="trigger_event" defaultValue="task_created" className={`${inputClass} w-full`}>
            {(Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">شرط: الأولوية (اختياري)</span>
          <select name="condition_priority" defaultValue="" className={`${inputClass} w-full`}>
            <option value="">أي أولوية</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الإجراء (Action)</span>
          <select
            name="action_type"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as AutomationAction)}
            className={`${inputClass} w-full`}
          >
            {(Object.keys(ACTION_LABEL) as AutomationAction[]).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </select>
        </label>

        {NEEDS_USER.includes(actionType) && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الشخص المستهدف</span>
            <select name="param_user_id" defaultValue="" required className={`${inputClass} w-full`}>
              <option value="" disabled>
                اختر موظفًا
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
        {actionType === "change_status" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الحالة الجديدة</span>
            <select name="param_status" defaultValue="" required className={`${inputClass} w-full`}>
              <option value="" disabled>
                اختر حالة
              </option>
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        {(actionType === "change_priority" || actionType === "create_followup_task") && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              الأولوية {actionType === "create_followup_task" && "(اختياري)"}
            </span>
            <select
              name="param_priority"
              defaultValue=""
              required={actionType === "change_priority"}
              className={`${inputClass} w-full`}
            >
              <option value="" disabled={actionType === "change_priority"}>
                اختر أولوية
              </option>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
        )}
        {actionType === "create_followup_task" && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان المهمة (اختياري)</span>
              <input name="param_title" className={`${inputClass} w-full`} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">المسند إليه (اختياري)</span>
              <select name="param_user_id" defaultValue="" className={`${inputClass} w-full`}>
                <option value="">نفس المسؤول عن المهمة الأصلية</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="flex items-end gap-3 lg:col-span-4">
          <button
            type="submit"
            disabled={creating}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            إضافة قاعدة
          </button>
          {createState?.error && <p className="text-sm text-red-600">{createState.error}</p>}
        </div>
      </form>

      <div className="space-y-3">
        {rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} executions={executionsByRule[rule.id] ?? []} />
        ))}
        {rules.length === 0 && (
          <p className="rounded-[18px] border border-border bg-surface p-6 text-center text-muted">
            لا توجد قواعد أتمتة بعد
          </p>
        )}
      </div>
    </div>
  );
}

function RuleCard({ rule, executions }: { rule: AutomationRule; executions: AutomationExecution[] }) {
  const [busy, setBusy] = useState(false);
  const successCount = executions.filter((e) => e.result === "success").length;
  const retryCount = executions.filter((e) => e.result === "retry_pending").length;
  const failedCount = executions.filter((e) => e.result === "error" || e.result === "failed").length;

  return (
    <div className="rounded-[18px] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-foreground">{rule.name}</h3>
          <p className="text-[12.5px] text-muted">
            {TRIGGER_LABEL[rule.trigger_event]}
            {rule.conditions?.priority && ` (أولوية: ${PRIORITY_LABEL[rule.conditions.priority as Priority]})`}
            {" ← "}
            {ACTION_LABEL[rule.action_type]}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11.5px] text-muted">
            نجح {successCount}
            {retryCount > 0 && ` · قيد إعادة المحاولة ${retryCount}`}
            {failedCount > 0 && ` · فشل نهائيًا ${failedCount}`}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await toggleAutomationRuleActive(rule.id, !rule.is_active);
              setBusy(false);
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-60 ${
              rule.is_active ? "bg-green-50 text-green-600" : "bg-border text-muted"
            }`}
          >
            {rule.is_active ? "نشطة" : "معطّلة"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm("حذف هذه القاعدة؟")) return;
              setBusy(true);
              await deleteAutomationRule(rule.id);
              setBusy(false);
            }}
            className="text-sm text-red-600 hover:underline disabled:opacity-60"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: AutomationRuleTemplate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-background p-3.5">
      <h4 className="text-[13px] font-extrabold text-foreground">{template.name}</h4>
      {template.description && <p className="text-[12px] text-muted">{template.description}</p>}
      <p className="text-[11.5px] text-faint">
        {TRIGGER_LABEL[template.trigger_event]}
        {" ← "}
        {ACTION_LABEL[template.action_type]}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await applyAutomationRuleTemplate(template.id);
          if (result.error) setError(result.error);
          setBusy(false);
        }}
        className="mt-1 self-start rounded-full bg-accent-500 px-3.5 py-1.5 text-[12px] font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {busy ? "جارٍ الإضافة..." : "استخدام هذا القالب"}
      </button>
      {error && <p className="text-[11.5px] text-red-600">{error}</p>}
    </div>
  );
}
