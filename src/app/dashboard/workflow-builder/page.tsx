import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/foundation/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { BoardIcon } from "@/components/shared/icons";
import { WorkflowFlowCreateForm } from "@/components/dashboard/workflow-flow-create-form";
import { FLOW_EXECUTION_STATUS_LABEL, type WorkflowFlow } from "@/lib/types/workflow-flow";

export default async function WorkflowBuilderPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can.manageWorkflowTemplates(profile)) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: flowsRaw }, { count: pendingApprovalsCount }] = await Promise.all([
    supabase.from("workflow_flows").select("*").order("flow_group_id").order("version", { ascending: false }).returns<WorkflowFlow[]>(),
    supabase.from("workflow_flow_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  // one row per flow_group_id - the latest version, since rows are already
  // ordered by version desc within each group
  const seen = new Set<string>();
  const latestPerGroup = (flowsRaw ?? []).filter((f) => {
    if (seen.has(f.flow_group_id)) return false;
    seen.add(f.flow_group_id);
    return true;
  });

  return (
    <div className="space-y-4.5">
      <PageHeader
        title="باني سير العمل"
        subtitle="سلاسل خطوات متعددة (شرط، مهمة، تعيين، إشعار، تأخير، موافقة) بدل قاعدة واحدة بسيطة"
        variant="teal"
        icon={<BoardIcon className="h-6 w-6" />}
        count={`${latestPerGroup.length} سير عمل`}
      />

      <WorkflowFlowCreateForm />

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface px-5.5 py-2">
        <table className="w-full text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="px-1.5 py-4 text-start">الاسم</th>
              <th className="px-1.5 py-4 text-start">الإصدار</th>
              <th className="px-1.5 py-4 text-start">الحالة</th>
              <th className="px-1.5 py-4 text-start">فعّال</th>
            </tr>
          </thead>
          <tbody>
            {latestPerGroup.map((flow) => (
              <tr key={flow.id} className="border-t border-border transition-colors hover:bg-background">
                <td className="px-1.5 py-4">
                  <Link href={`/dashboard/workflow-builder/${flow.id}`} className="font-medium text-foreground hover:text-accent-600">
                    {flow.name}
                  </Link>
                  {flow.description && <p className="text-[12px] text-muted">{flow.description}</p>}
                </td>
                <td className="px-1.5 py-4 text-muted">{flow.version}</td>
                <td className="px-1.5 py-4 text-muted">{flow.status === "draft" ? "مسودة" : "منشور"}</td>
                <td className="px-1.5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${flow.is_active ? "bg-green-50 text-green-600" : "bg-border text-muted"}`}>
                    {flow.is_active ? "فعّال" : "معطَّل"}
                  </span>
                </td>
              </tr>
            ))}
            {latestPerGroup.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-faint">
                      <BoardIcon className="h-5 w-5" />
                    </span>
                    <p className="text-[13px] text-muted">لا توجد سلاسل عمل بعد</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(pendingApprovalsCount ?? 0) > 0 && (
        <p className="text-[12.5px] font-bold text-accent-600">
          {pendingApprovalsCount} {FLOW_EXECUTION_STATUS_LABEL.waiting_approval} - راجع صفحة كل سير عمل لعرض التفاصيل
        </p>
      )}
    </div>
  );
}
