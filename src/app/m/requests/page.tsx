import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MobileRequestForm } from "@/components/mobile/mobile-request-form";
import { MobileApprovalsList } from "@/components/mobile/mobile-approvals-list";
import { WORKFLOW_STATUS_LABEL, type WorkflowRequest, type WorkflowTemplate } from "@/lib/types/workflow";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-border text-muted",
  pending: "bg-accent-50 text-accent-700",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-brand-red-50 text-brand-red-500",
  processing: "bg-purple-50 text-purple-600",
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-border text-muted",
};

export default async function MobileRequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { tab: tabParam } = await searchParams;
  const isManagerRole = profile.role !== "employee";
  const tab = tabParam === "approvals" && isManagerRole ? "approvals" : "mine";

  const supabase = await createClient();
  const [{ data: myRequests }, { data: templates }, approvalsResult] = await Promise.all([
    supabase
      .from("workflow_requests")
      .select("*, template:workflow_templates(name)")
      .eq("requested_by", profile.id)
      .order("created_at", { ascending: false })
      .returns<(WorkflowRequest & { template: { name: string } | null })[]>(),
    supabase.from("workflow_templates").select("*").eq("is_active", true).returns<WorkflowTemplate[]>(),
    isManagerRole
      ? supabase
          .from("workflow_requests")
          .select("id, title, created_at, template:workflow_templates(name), requester:users!workflow_requests_requested_by_fkey(full_name)")
          .eq("status", "pending")
          .neq("requested_by", profile.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const approvalRows = (
    (approvalsResult.data ?? []) as unknown as {
      id: string;
      title: string;
      created_at: string;
      template: { name: string } | null;
      requester: { full_name: string } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    created_at: r.created_at,
    template_name: r.template?.name ?? null,
    requester_name: r.requester?.full_name ?? null,
  }));

  return (
    <div>
      <MobileHeader title="الطلبات والموافقات" />
      <div className="px-4">
        <div className="mb-4 flex rounded-[12px] bg-background p-1">
          <Link
            href="/m/requests?tab=mine"
            className={`flex-1 rounded-[9px] py-2 text-center text-[12.5px] font-bold ${tab === "mine" ? "bg-accent-600 text-white" : "text-muted"}`}
          >
            طلباتي
          </Link>
          {isManagerRole && (
            <Link
              href="/m/requests?tab=approvals"
              className={`flex-1 rounded-[9px] py-2 text-center text-[12.5px] font-bold ${tab === "approvals" ? "bg-accent-600 text-white" : "text-muted"}`}
            >
              الموافقات {approvalRows.length > 0 ? `(${approvalRows.length})` : ""}
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 pb-6">
        {tab === "mine" ? (
          <>
            <MobileRequestForm templates={templates ?? []} />
            <div className="flex flex-col gap-2.5">
              {(myRequests ?? []).map((r) => (
                <div key={r.id} className="rounded-[14px] bg-surface p-3.5 shadow-[0_4px_12px_rgba(30,41,59,.06)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-foreground">{r.template?.name ? `${r.title} (${r.template.name})` : r.title}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${STATUS_BADGE[r.status]}`}>
                      {WORKFLOW_STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] font-semibold text-muted">{new Date(r.created_at).toLocaleDateString("ar")}</div>
                </div>
              ))}
              {(myRequests ?? []).length === 0 && <p className="py-8 text-center text-[13px] text-muted">لا توجد طلبات مقدَّمة</p>}
            </div>
          </>
        ) : (
          <MobileApprovalsList requests={approvalRows} />
        )}
      </div>
    </div>
  );
}
