import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { WorkflowRequestForm } from "@/components/dashboard/workflow-request-form";
import { GearIcon } from "@/components/shared/icons";
import { WORKFLOW_STATUS_LABEL, type WorkflowRequest, type WorkflowTemplate } from "@/lib/types/workflow";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-border text-muted",
  pending: "bg-accent-50 text-accent-700",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-brand-red-50 text-brand-red-500",
  processing: "bg-purple-50 text-purple-600",
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-border text-muted",
};

export default async function WorkflowRequestsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  // RLS on workflow_requests already returns exactly what this viewer may
  // see - their own requests, plus anything they can currently act on, plus
  // everything if they're super_admin
  const [{ data: requests }, { data: templates }] = await Promise.all([
    supabase
      .from("workflow_requests")
      .select("*, template:workflow_templates(name), requester:users!workflow_requests_requested_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .returns<(WorkflowRequest & { template: { name: string } | null; requester: { full_name: string } | null })[]>(),
    supabase.from("workflow_templates").select("*").eq("is_active", true).returns<WorkflowTemplate[]>(),
  ]);

  return (
    <div className="space-y-4.5">
      <PageHeader
        title="الطلبات"
        subtitle="طلبات إجازة وشراء وصيانة وغيرها - محرك موافقات واحد لكل الأنواع"
        variant="teal"
        icon={<GearIcon className="h-6 w-6" />}
        count={`${requests?.length ?? 0} طلب`}
      />

      <WorkflowRequestForm templates={templates ?? []} />

      <div className="overflow-x-auto rounded-[18px] border border-border bg-surface px-5.5 py-2">
        <table className="w-full text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="px-1.5 py-4 text-start">العنوان</th>
              <th className="px-1.5 py-4 text-start">النوع</th>
              <th className="px-1.5 py-4 text-start">مقدّم الطلب</th>
              <th className="px-1.5 py-4 text-start">الأولوية</th>
              <th className="px-1.5 py-4 text-start">الخطوة الحالية</th>
              <th className="px-1.5 py-4 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((req) => (
              <tr key={req.id} className="border-t border-border">
                <td className="px-1.5 py-4">
                  <Link href={`/dashboard/workflow-requests/${req.id}`} className="font-medium text-foreground hover:text-accent-600">
                    {req.title}
                  </Link>
                </td>
                <td className="px-1.5 py-4 text-muted">{req.template?.name ?? "—"}</td>
                <td className="px-1.5 py-4 text-muted">{req.requester?.full_name ?? "—"}</td>
                <td className="px-1.5 py-4 text-muted">{PRIORITY_LABEL[req.priority as Priority] ?? req.priority}</td>
                <td className="px-1.5 py-4 text-muted">{req.status === "pending" ? req.current_step_position : "—"}</td>
                <td className="px-1.5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[req.status]}`}>
                    {WORKFLOW_STATUS_LABEL[req.status]}
                    {req.status === "pending" && req.is_escalated && " (مصعَّد)"}
                  </span>
                </td>
              </tr>
            ))}
            {(requests ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  لا توجد طلبات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
