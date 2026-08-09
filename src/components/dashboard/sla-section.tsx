import { SLA_STATE_COLOR, SLA_STATE_LABEL, type TaskSla } from "@/lib/types/sla";

function formatRemaining(seconds: number) {
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.round((abs % 3600) / 60);
  const label = `${hours}س ${minutes}د`;
  return seconds < 0 ? `تجاوز بـ${label}` : `متبقٍ ${label}`;
}

/**
 * Server component - task_sla() is queried once on the task page itself
 * (see tasks/[id]/page.tsx), this just renders the row. No emoji: the
 * plan's own 🟢/🟡/🔴 example is illustrative text, not a UI instruction -
 * this project's standing rule is colour + text via shared/icons.tsx tokens,
 * never emoji as icons.
 */
export function SlaSection({ sla }: { sla: TaskSla | null }) {
  if (!sla) {
    return (
      <section className="rounded-[18px] border border-border bg-surface p-6">
        <h2 className="mb-1 text-sm font-extrabold text-foreground">SLA</h2>
        <p className="text-sm text-muted">لا توجد سياسة SLA نشطة لأولوية هذه المهمة</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-[18px] border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-foreground">SLA — {sla.policy_name}</h2>
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${SLA_STATE_COLOR[sla.sla_state]}`}>
          {SLA_STATE_LABEL[sla.sla_state]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-4">
        <div>
          <span className="block text-muted">استحقاق الاستجابة</span>
          <span className={`font-bold ${sla.response_breached ? "text-brand-red-500" : "text-foreground"}`}>
            {new Date(sla.response_due).toLocaleString("ar")}
          </span>
        </div>
        <div>
          <span className="block text-muted">استحقاق الإنجاز</span>
          <span className={`font-bold ${sla.resolution_breached ? "text-brand-red-500" : "text-foreground"}`}>
            {new Date(sla.resolution_due).toLocaleString("ar")}
          </span>
        </div>
        <div>
          <span className="block text-muted">الاستجابة</span>
          <span className="font-bold text-foreground">{sla.responded ? "تمّت" : "لم تتم بعد"}</span>
        </div>
        <div>
          <span className="block text-muted">الوقت المتبقي للإنجاز</span>
          <span className="font-bold text-foreground">{formatRemaining(sla.remaining_seconds)}</span>
        </div>
      </div>
    </section>
  );
}
