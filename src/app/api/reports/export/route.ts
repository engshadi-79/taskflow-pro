import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/types/task";

type TopEmployeeRow = { full_name: string; completed_count: number };
type TopDepartmentRow = { department_name: string; completed_count: number };
type TaskExportRow = {
  title: string;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  assignee: { full_name: string } | null;
};

export async function GET() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role === "employee") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const supabase = await createClient();

  const [
    { data: topEmployeesRaw },
    { data: topDepartmentsRaw },
    { data: avgHours },
    { data: delayRate },
    { data: tasksRaw },
  ] = await Promise.all([
    supabase.rpc("report_top_employees"),
    supabase.rpc("report_top_departments"),
    supabase.rpc("report_avg_completion_hours"),
    supabase.rpc("report_delay_rate"),
    supabase
      .from("tasks")
      .select("title, priority, status, due_date, assignee:users!tasks_assigned_to_fkey(full_name)")
      .order("created_at", { ascending: false }),
  ]);

  const topEmployees = (topEmployeesRaw ?? []) as TopEmployeeRow[];
  const topDepartments = (topDepartmentsRaw ?? []) as TopDepartmentRow[];
  const tasks = (tasksRaw ?? []) as unknown as TaskExportRow[];

  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("ملخص");
  summarySheet.addRow(["متوسط وقت الإنجاز (ساعة)", avgHours ?? "—"]);
  summarySheet.addRow(["نسبة التأخير (%)", delayRate ?? 0]);
  summarySheet.addRow([]);
  summarySheet.addRow(["أكثر الموظفين إنجازًا"]);
  summarySheet.addRow(["الاسم", "عدد المهام المنجزة"]);
  topEmployees.forEach((row) => summarySheet.addRow([row.full_name, row.completed_count]));

  if (topDepartments.length > 0) {
    summarySheet.addRow([]);
    summarySheet.addRow(["أكثر الأقسام إنتاجية"]);
    summarySheet.addRow(["القسم", "عدد المهام المنجزة"]);
    topDepartments.forEach((row) => summarySheet.addRow([row.department_name, row.completed_count]));
  }

  const tasksSheet = workbook.addWorksheet("المهام");
  tasksSheet.addRow(["العنوان", "المسؤول", "الأولوية", "الحالة", "تاريخ الاستحقاق"]);
  tasks.forEach((task) => {
    tasksSheet.addRow([
      task.title,
      task.assignee?.full_name ?? "—",
      PRIORITY_LABEL[task.priority],
      STATUS_LABEL[task.status],
      task.due_date ?? "—",
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="taskflow-report.xlsx"',
    },
  });
}
