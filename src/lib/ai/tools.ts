import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/roles";

export type ToolContext = { supabase: SupabaseClient; profile: Profile };

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/**
 * Read-only tools run the caller's own RLS-scoped Supabase client - the same
 * client every Server Action already uses - so the AI can never see a row
 * the signed-in user couldn't already query themselves. This is the
 * "Permission-Aware Context" Prompt 16 asks for: enforced by Postgres RLS,
 * not by anything the model decides to respect.
 *
 * Action tools (reassign_task, create_subtasks) never touch the tasks table.
 * They only insert a row into ai_suggested_actions with status='pending' and
 * hand back its id - the real mutation happens later in
 * src/lib/actions/ai.ts, through the same MANAGE_ROLES check tasks.ts
 * already uses, once a human clicks "تأكيد".
 */

const MANAGE_ROLES = ["super_admin", "department_manager"];

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_department_performance",
    description:
      "أداء الأقسام: عدد المهام، المكتملة، المتأخرة، نسبة الإنجاز، متوسط ساعات الإنجاز لكل قسم.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_employee_performance",
    description: "أداء الموظفين (اختياريًا حسب قسم واحد) - نفس مؤشرات أداء الأقسام لكل موظف.",
    input_schema: {
      type: "object",
      properties: { department_id: { type: "string", description: "UUID القسم (اختياري)" } },
    },
  },
  {
    name: "get_project_performance",
    description: "أداء المشاريع (اختياريًا مشروع واحد) - عدد المهام وحالتها ونسبة الإنجاز.",
    input_schema: {
      type: "object",
      properties: { project_id: { type: "string", description: "UUID المشروع (اختياري)" } },
    },
  },
  {
    name: "get_priority_performance",
    description: "توزيع المهام حسب الأولوية مع نسبة الإنجاز ومتوسط وقت الإنجاز لكل أولوية.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_overdue_by_department",
    description: "عدد المهام المتأخرة حاليًا في كل قسم - لاكتشاف أكثر قسم فيه تأخير.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_workload",
    description:
      "حمل العمل لكل موظف (عدد المهام المفتوحة، العاجلة، المتأخرة، مؤشر الحمل وحالته Low/Normal/High/Critical). استخدمه لاقتراح إعادة توزيع المهام.",
    input_schema: {
      type: "object",
      properties: {
        department_id: { type: "string", description: "UUID القسم (اختياري)" },
        project_id: { type: "string", description: "UUID المشروع (اختياري)" },
      },
    },
  },
  {
    name: "get_sla_report",
    description: "نسبة الالتزام بـ SLA، عدد المهام المتجاوزة، متوسط وقت الاستجابة والإنجاز.",
    input_schema: {
      type: "object",
      properties: {
        department_id: { type: "string", description: "UUID القسم (اختياري)" },
        user_id: { type: "string", description: "UUID الموظف (اختياري)" },
      },
    },
  },
  {
    name: "get_at_risk_tasks",
    description:
      "المهام المعرضة للتأخير: غير مكتملة ولها موعد استحقاق خلال عدد الأيام المحدد، أو متأخرة حاليًا.",
    input_schema: {
      type: "object",
      properties: {
        within_days: { type: "number", description: "عدد الأيام القادمة (افتراضي 3)" },
      },
    },
  },
  {
    name: "get_employee_summary",
    description: "ملخص مهام موظف معيّن: المكتملة، نسبة الالتزام بالموعد، متوسط وقت الإنجاز، والمهام المفتوحة حاليًا.",
    input_schema: {
      type: "object",
      properties: { user_id: { type: "string", description: "UUID الموظف" } },
      required: ["user_id"],
    },
  },
  {
    name: "get_project_summary",
    description: "ملخص مشروع: اسمه وحالته وموعده النهائي وإحصاءات مهامه.",
    input_schema: {
      type: "object",
      properties: { project_id: { type: "string", description: "UUID المشروع" } },
      required: ["project_id"],
    },
  },
  {
    name: "get_meeting_summary",
    description: "تفاصيل اجتماع: العنوان والتاريخ والمنظم وجدول الأعمال ومحضر الاجتماع - لتلخيصه أو لاقتراح تحويل بنوده إلى مهام.",
    input_schema: {
      type: "object",
      properties: { meeting_id: { type: "string", description: "UUID الاجتماع" } },
      required: ["meeting_id"],
    },
  },
  {
    name: "search_knowledge",
    description: "بحث في قاعدة المعرفة (السياسات والإجراءات والنماذج والأدلة).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "نص البحث" } },
      required: ["query"],
    },
  },
  {
    name: "list_departments",
    description: "قائمة الأقسام في المؤسسة (id, name) - استخدمها لترجمة أسماء الأقسام إلى UUID عند الحاجة.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_projects",
    description: "قائمة المشاريع في المؤسسة (id, name, status).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_employees",
    description: "قائمة الموظفين النشطين (id, full_name, department_id, role) - لترجمة الأسماء إلى UUID عند اقتراح إعادة توزيع مهمة.",
    input_schema: {
      type: "object",
      properties: { department_id: { type: "string", description: "UUID القسم (اختياري)" } },
    },
  },
  {
    name: "suggest_reassign_task",
    description:
      "اقترح نقل مهمة من موظف إلى آخر. لا يُنفَّذ الاقتراح تلقائيًا؛ يظهر للمستخدم كبطاقة يجب أن يضغط فيها [تأكيد] بنفسه.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID المهمة" },
        new_assignee_id: { type: "string", description: "UUID الموظف الجديد" },
        reason: { type: "string", description: "سبب مختصر للاقتراح" },
      },
      required: ["task_id", "new_assignee_id", "reason"],
    },
  },
  {
    name: "suggest_create_subtasks",
    description:
      "اقترح تقسيم مهمة إلى مهام فرعية. لا يُنفَّذ تلقائيًا؛ يظهر للمستخدم كبطاقة يجب أن يضغط فيها [تأكيد] بنفسه.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID المهمة الرئيسية" },
        subtasks: {
          type: "array",
          description: "قائمة المهام الفرعية المقترحة",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              assigned_to: { type: "string", description: "UUID الموظف المسند إليه" },
            },
            required: ["title", "assigned_to"],
          },
        },
      },
      required: ["task_id", "subtasks"],
    },
  },
];

export type SuggestedActionDraft = {
  action_type: "reassign_task" | "create_subtasks";
  target_type: "task";
  target_id: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type ToolResult =
  | { kind: "data"; data: unknown }
  | { kind: "suggestion"; draft: SuggestedActionDraft }
  | { kind: "error"; message: string };

export async function runTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const { supabase } = ctx;

  switch (name) {
    case "get_department_performance": {
      const { data, error } = await supabase.rpc("report_department_performance");
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_employee_performance": {
      const { data, error } = await supabase.rpc("report_employee_performance", {
        p_department_id: input.department_id ?? null,
      });
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_project_performance": {
      const { data, error } = await supabase.rpc("report_project_performance", {
        p_project_id: input.project_id ?? null,
      });
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_priority_performance": {
      const { data, error } = await supabase.rpc("report_priority_performance");
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_overdue_by_department": {
      const { data, error } = await supabase.rpc("report_overdue_by_department");
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_workload": {
      const { data, error } = await supabase.rpc("employee_workload", {
        p_department_id: input.department_id ?? null,
        p_project_id: input.project_id ?? null,
      });
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_sla_report": {
      const { data, error } = await supabase.rpc("sla_report", {
        p_department_id: input.department_id ?? null,
        p_user_id: input.user_id ?? null,
      });
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_at_risk_tasks": {
      const withinDays = typeof input.within_days === "number" ? input.within_days : 3;
      const until = new Date();
      until.setDate(until.getDate() + withinDays);
      const untilKey = until.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, priority, status, due_date, assignee:users!tasks_assigned_to_fkey(full_name)")
        .not("status", "in", "(completed,cancelled)")
        .not("due_date", "is", null)
        .lte("due_date", untilKey)
        .order("due_date", { ascending: true })
        .limit(30);
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "get_employee_summary": {
      const userId = input.user_id as string;
      const [{ data: stats, error: statsError }, { data: openTasks, error: tasksError }] = await Promise.all([
        supabase.rpc("report_employee_stats", { p_user_id: userId }),
        supabase
          .from("tasks")
          .select("id, title, priority, status, due_date")
          .eq("assigned_to", userId)
          .not("status", "in", "(completed,cancelled)")
          .order("due_date", { ascending: true }),
      ]);
      if (statsError) return { kind: "error", message: statsError.message };
      if (tasksError) return { kind: "error", message: tasksError.message };
      return { kind: "data", data: { stats: stats?.[0] ?? null, open_tasks: openTasks ?? [] } };
    }
    case "get_project_summary": {
      const projectId = input.project_id as string;
      const [{ data: project, error: projectError }, { data: stats, error: statsError }] = await Promise.all([
        supabase.from("projects").select("id, name, status, due_date, manager_id").eq("id", projectId).single(),
        supabase.rpc("project_task_stats", { p_project_id: projectId }),
      ]);
      if (projectError) return { kind: "error", message: projectError.message };
      if (statsError) return { kind: "error", message: statsError.message };
      return { kind: "data", data: { project, stats: stats?.[0] ?? null } };
    }
    case "get_meeting_summary": {
      const meetingId = input.meeting_id as string;
      const [{ data: meeting, error: meetingError }, { data: extra }, { data: agenda }, { data: minutes }] =
        await Promise.all([
          supabase.from("meetings").select("id, title, meeting_date, meeting_time, location, status").eq("id", meetingId).single(),
          supabase.rpc("meeting_detail_extra", { p_meeting_id: meetingId }),
          supabase.from("meeting_agenda_items").select("id, content").eq("meeting_id", meetingId),
          supabase.from("meeting_minutes_items").select("id, content, converted_task_id").eq("meeting_id", meetingId),
        ]);
      if (meetingError) return { kind: "error", message: meetingError.message };
      return {
        kind: "data",
        data: { meeting, organizer: extra?.[0] ?? null, agenda: agenda ?? [], minutes: minutes ?? [] },
      };
    }
    case "search_knowledge": {
      const { data, error } = await supabase.rpc("search_knowledge_articles", {
        p_query: input.query as string,
      });
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "list_departments": {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "list_projects": {
      const { data, error } = await supabase.from("projects").select("id, name, status").order("name");
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }
    case "list_employees": {
      let query = supabase.from("users").select("id, full_name, department_id, role").eq("is_active", true).order("full_name");
      if (input.department_id) query = query.eq("department_id", input.department_id as string);
      const { data, error } = await query;
      if (error) return { kind: "error", message: error.message };
      return { kind: "data", data };
    }

    case "suggest_reassign_task": {
      if (!MANAGE_ROLES.includes(ctx.profile.role)) {
        return { kind: "error", message: "هذا الإجراء يتطلب صلاحية مدير - لا يمكن اقتراحه لحسابك." };
      }
      const taskId = input.task_id as string;
      const newAssigneeId = input.new_assignee_id as string;
      const { data: task, error } = await supabase
        .from("tasks")
        .select("id, title, assigned_to")
        .eq("id", taskId)
        .single();
      if (error || !task) return { kind: "error", message: "المهمة غير موجودة أو لا يمكنك الوصول إليها." };
      const { data: assignee } = await supabase.from("users").select("full_name").eq("id", newAssigneeId).single();
      return {
        kind: "suggestion",
        draft: {
          action_type: "reassign_task",
          target_type: "task",
          target_id: taskId,
          summary: `نقل المهمة "${task.title}" إلى ${assignee?.full_name ?? "موظف آخر"}`,
          payload: { task_id: taskId, new_assignee_id: newAssigneeId, reason: input.reason ?? null },
        },
      };
    }
    case "suggest_create_subtasks": {
      if (!MANAGE_ROLES.includes(ctx.profile.role)) {
        return { kind: "error", message: "هذا الإجراء يتطلب صلاحية مدير - لا يمكن اقتراحه لحسابك." };
      }
      const taskId = input.task_id as string;
      const subtasks = (input.subtasks as { title: string; assigned_to: string }[]) ?? [];
      if (subtasks.length === 0) return { kind: "error", message: "لم تُحدَّد أي مهام فرعية." };
      const { data: task, error } = await supabase.from("tasks").select("id, title").eq("id", taskId).single();
      if (error || !task) return { kind: "error", message: "المهمة غير موجودة أو لا يمكنك الوصول إليها." };
      return {
        kind: "suggestion",
        draft: {
          action_type: "create_subtasks",
          target_type: "task",
          target_id: taskId,
          summary: `تقسيم المهمة "${task.title}" إلى ${subtasks.length} مهام فرعية`,
          payload: { task_id: taskId, subtasks },
        },
      };
    }

    default:
      return { kind: "error", message: `أداة غير معروفة: ${name}` };
  }
}
