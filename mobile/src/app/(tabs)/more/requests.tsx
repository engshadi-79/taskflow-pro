import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { PRIORITY_LABEL, type Priority } from "@/lib/mobile-theme";

type RequestStatus = "draft" | "pending" | "approved" | "rejected" | "processing" | "completed" | "cancelled";
type Template = { id: string; name: string };
type MyRequest = { id: string; title: string; status: RequestStatus; created_at: string; template: { name: string } | null };
type ApprovalRow = { id: string; title: string; created_at: string; template: { name: string } | null; requester: { full_name: string } | null };

const STATUS_LABEL: Record<RequestStatus, string> = {
  draft: "مسودة",
  pending: "قيد المعالجة",
  approved: "مقبول",
  rejected: "مرفوض",
  processing: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغى",
};
const STATUS_BADGE: Record<RequestStatus, { bg: string; text: string }> = {
  draft: { bg: "#e2e8f0", text: "#64748b" },
  pending: { bg: "#eef2ff", text: "#4338ca" },
  approved: { bg: "#ecfdf5", text: "#16a34a" },
  rejected: { bg: "#fef2f2", text: "#dc2626" },
  processing: { bg: "#faf5ff", text: "#9333ea" },
  completed: { bg: "#ecfdf5", text: "#16a34a" },
  cancelled: { bg: "#e2e8f0", text: "#64748b" },
};
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export default function RequestsScreen() {
  const { profile } = useAuth();
  const isManagerRole = profile?.role !== "employee";
  const [tab, setTab] = useState<"mine" | "approvals">("mine");
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);

  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: templateRows }, { data: myRows }, approvalsResult] = await Promise.all([
      supabase.from("workflow_templates").select("id, name").eq("is_active", true).returns<Template[]>(),
      supabase
        .from("workflow_requests")
        .select("id, title, status, created_at, template:workflow_templates(name)")
        .eq("requested_by", profile.id)
        .order("created_at", { ascending: false })
        .returns<MyRequest[]>(),
      isManagerRole
        ? supabase
            .from("workflow_requests")
            .select("id, title, created_at, template:workflow_templates(name), requester:users!workflow_requests_requested_by_fkey(full_name)")
            .eq("status", "pending")
            .neq("requested_by", profile.id)
            .order("created_at", { ascending: true })
            .returns<ApprovalRow[]>()
        : Promise.resolve({ data: [] as ApprovalRow[] }),
    ]);
    setTemplates(templateRows ?? []);
    setMyRequests(myRows ?? []);
    setApprovals(approvalsResult.data ?? []);
    setLoading(false);
  }, [profile, isManagerRole]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitRequest() {
    if (!templateId) return setFormError("اختر نوع الطلب");
    if (!title.trim()) return setFormError("عنوان الطلب مطلوب");
    setFormError("");
    setPending(true);
    const { error } = await supabase.rpc("submit_workflow_request", {
      p_template_id: templateId,
      p_title: title.trim(),
      p_details: details.trim() || null,
      p_priority: priority,
      p_save_as_draft: false,
    });
    setPending(false);
    if (error) return setFormError(error.message || "تعذر تقديم الطلب");
    setTitle("");
    setDetails("");
    setTemplateId("");
    setPriority("medium");
    load();
  }

  async function decide(id: string, action: "approve" | "reject") {
    setPending(true);
    await supabase.rpc("act_on_workflow_request", { p_request_id: id, p_action: action, p_note: null, p_target_user_id: null });
    setPending(false);
    load();
  }

  async function bulkApprove() {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) return;
    setPending(true);
    await supabase.rpc("bulk_approve_workflow_requests", { p_request_ids: ids });
    setSelected({});
    setPending(false);
    load();
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader back title="الطلبات والموافقات" />
      <View className="px-4">
        <View className="mb-4 flex-row rounded-[12px] bg-background p-1">
          <TouchableOpacity onPress={() => setTab("mine")} className={`flex-1 items-center rounded-[9px] py-2 ${tab === "mine" ? "bg-accent-600" : ""}`}>
            <Text className={`text-[12.5px] font-bold ${tab === "mine" ? "text-white" : "text-muted"}`}>طلباتي</Text>
          </TouchableOpacity>
          {isManagerRole && (
            <TouchableOpacity
              onPress={() => setTab("approvals")}
              className={`flex-1 items-center rounded-[9px] py-2 ${tab === "approvals" ? "bg-accent-600" : ""}`}
            >
              <Text className={`text-[12.5px] font-bold ${tab === "approvals" ? "text-white" : "text-muted"}`}>
                الموافقات {approvals.length > 0 ? `(${approvals.length})` : ""}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-8" color="#4f46e5" />
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24, gap: 10 }}>
          {tab === "mine" ? (
            <>
              <View className="mb-1 gap-2.5 rounded-[14px] bg-surface p-3.5 shadow">
                <Text className="mb-1 text-[12.5px] font-extrabold text-foreground">تقديم طلب جديد</Text>
                <View className="rounded-[10px] border border-border bg-background">
                  {templates.map((t) => (
                    <TouchableOpacity key={t.id} onPress={() => setTemplateId(t.id)} className="flex-row items-center justify-between px-3 py-2.5">
                      <Text className="text-[12.5px] text-foreground">{t.name}</Text>
                      {templateId === t.id && <Text className="text-accent-600">✓</Text>}
                    </TouchableOpacity>
                  ))}
                  {templates.length === 0 && <Text className="px-3 py-2.5 text-[12.5px] text-muted">لا توجد أنواع طلبات متاحة</Text>}
                </View>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="عنوان الطلب"
                  placeholderTextColor="#94a3b8"
                  className="rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] text-foreground"
                />
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="سبب الطلب..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                  className="rounded-[10px] border border-border bg-background px-3 py-2 text-[12.5px] text-foreground"
                />
                <View className="flex-row gap-2">
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      className={`flex-1 items-center rounded-[9px] border py-2 ${priority === p ? "border-accent-600 bg-accent-50" : "border-border"}`}
                    >
                      <Text className={`text-[11px] font-bold ${priority === p ? "text-accent-700" : "text-muted"}`}>{PRIORITY_LABEL[p]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={submitRequest}
                  disabled={pending}
                  className="items-center rounded-[10px] bg-accent-600 py-2.5"
                  style={{ opacity: pending ? 0.6 : 1 }}
                >
                  <Text className="text-[12.5px] font-extrabold text-white">إرسال الطلب</Text>
                </TouchableOpacity>
                {!!formError && <Text className="text-[11.5px] text-brand-red-600">{formError}</Text>}
              </View>

              {myRequests.map((r) => (
                <View key={r.id} className="rounded-[14px] bg-surface p-3.5 shadow">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] font-bold text-foreground">
                      {r.template?.name ? `${r.title} (${r.template.name})` : r.title}
                    </Text>
                    <View className="shrink-0 rounded-full px-2.5 py-1" style={{ backgroundColor: STATUS_BADGE[r.status].bg }}>
                      <Text className="text-[10px] font-extrabold" style={{ color: STATUS_BADGE[r.status].text }}>
                        {STATUS_LABEL[r.status]}
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-1.5 text-[11px] font-semibold text-muted">{new Date(r.created_at).toLocaleDateString("ar")}</Text>
                </View>
              ))}
              {myRequests.length === 0 && <Text className="py-8 text-center text-[13px] text-muted">لا توجد طلبات مقدَّمة</Text>}
            </>
          ) : (
            <>
              {approvals.map((r) => (
                <View key={r.id} className="rounded-[14px] bg-surface p-3.5 shadow">
                  <TouchableOpacity onPress={() => setSelected((s) => ({ ...s, [r.id]: !s[r.id] }))} className="flex-row items-center gap-2.5">
                    <View
                      className="h-[18px] w-[18px] shrink-0 rounded-[5px] border-2"
                      style={{ borderColor: selected[r.id] ? "#4f46e5" : "#e2e8f0", backgroundColor: selected[r.id] ? "#4f46e5" : "transparent" }}
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="text-[13px] font-bold text-foreground">{r.template?.name ? `${r.title} (${r.template.name})` : r.title}</Text>
                      <Text className="mt-0.5 text-[11px] font-semibold text-muted">{r.requester?.full_name ?? "—"}</Text>
                    </View>
                  </TouchableOpacity>
                  <View className="mt-2.5 flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => decide(r.id, "approve")}
                      disabled={pending}
                      className="flex-1 items-center rounded-[9px] bg-green-50 py-2"
                      style={{ opacity: pending ? 0.6 : 1 }}
                    >
                      <Text className="text-[11.5px] font-extrabold text-green-600">موافقة</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => decide(r.id, "reject")}
                      disabled={pending}
                      className="flex-1 items-center rounded-[9px] bg-brand-red-50 py-2"
                      style={{ opacity: pending ? 0.6 : 1 }}
                    >
                      <Text className="text-[11.5px] font-extrabold text-brand-red-600">رفض</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {approvals.length === 0 && <Text className="py-8 text-center text-[13px] text-muted">لا توجد طلبات بانتظار موافقتك</Text>}
              {selectedCount > 0 && (
                <TouchableOpacity
                  onPress={bulkApprove}
                  disabled={pending}
                  className="items-center rounded-[10px] bg-accent-600 py-2.5"
                  style={{ opacity: pending ? 0.6 : 1 }}
                >
                  <Text className="text-[12.5px] font-extrabold text-white">موافقة جماعية ({selectedCount})</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
