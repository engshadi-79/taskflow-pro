"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/data/profile";

export type DemoSeedState = { error?: string; summary?: string[] };

const PROJECT_NAME = "مشروع التمكين الاقتصادي للفئات الأشد ضعفاً وذوي الإعاقة في قطاع غزة";
const DEMO_PASSWORD = "Demo@2026!";

type EmployeeSeed = {
  key: string;
  email: string;
  full_name: string;
  role: "department_manager" | "employee";
  dept: string;
  job_title: string;
};

const DEPARTMENTS = [
  "الإدارة والتنسيق",
  "الشؤون المالية والإدارية",
  "الفريق الميداني والاجتماعي",
  "الإعلام والتوثيق",
  "التدريب والمدربون",
];

const EMPLOYEES: EmployeeSeed[] = [
  { key: "coordinator", email: "coordinator@example.com", full_name: "أحمد الشريف", role: "department_manager", dept: "الإدارة والتنسيق", job_title: "منسق المشروع" },
  { key: "finance", email: "finance@example.com", full_name: "سارة النجار", role: "department_manager", dept: "الشؤون المالية والإدارية", job_title: "المسؤول المالي" },
  { key: "admin_assist", email: "admin.assist@example.com", full_name: "محمد أبو ريدة", role: "employee", dept: "الإدارة والتنسيق", job_title: "مساعد إداري" },
  { key: "consultant", email: "consultant@example.com", full_name: "خالد ياسين", role: "employee", dept: "الإدارة والتنسيق", job_title: "استشاري المشروع" },
  { key: "spaces_coordinator", email: "spaces.coordinator@example.com", full_name: "يوسف العطار", role: "department_manager", dept: "الفريق الميداني والاجتماعي", job_title: "منسق المساحات التدريبية" },
  { key: "field_team", email: "field.team@example.com", full_name: "هبة قنديل", role: "employee", dept: "الفريق الميداني والاجتماعي", job_title: "الفريق الميداني والاجتماعي" },
  { key: "photographer", email: "photographer@example.com", full_name: "عمر النجار", role: "employee", dept: "الإعلام والتوثيق", job_title: "مصور توثيق" },
  { key: "trainer_vocational", email: "trainer.vocational@example.com", full_name: "زياد حماد", role: "employee", dept: "التدريب والمدربون", job_title: "مدرب الحلاقة والإكسسوارات" },
  { key: "trainer_beauty", email: "trainer.beauty@example.com", full_name: "منى أبو شعبان", role: "employee", dept: "التدريب والمدربون", job_title: "مدربة التجميل والتطريز" },
  { key: "trainer_digital", email: "trainer.digital@example.com", full_name: "رنا صبح", role: "employee", dept: "التدريب والمدربون", job_title: "مدربة المسارات الرقمية" },
];

const DEPT_MANAGER: Record<string, string> = {
  "الإدارة والتنسيق": "coordinator",
  "الشؤون المالية والإدارية": "finance",
  "الفريق الميداني والاجتماعي": "spaces_coordinator",
};

/**
 * One-time demo scenario seeder, modeled on the attached KSrelief/Saudi
 * Center for Culture & Heritage "economic empowerment" project proposal -
 * so the user can test-drive the whole app (team, project, tasks,
 * meetings) with realistic content instead of an empty state.
 *
 * Idempotent: refuses to run twice for the same organization (checked via
 * the project name), since re-running would try to recreate the same
 * employee emails and fail halfway through.
 */
export async function seedGazaEmpowermentDemo(): Promise<DemoSeedState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return { error: "غير مصرح لك بتنفيذ هذا الإجراء" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("name", PROJECT_NAME)
    .maybeSingle();
  if (existing) {
    return { error: "تم تنفيذ هذا السيناريو التجريبي مسبقًا في هذه المؤسسة" };
  }

  // 1) departments
  const deptIdByName = new Map<string, string>();
  for (const name of DEPARTMENTS) {
    const { data, error } = await supabase
      .from("departments")
      .insert({ organization_id: profile.organization_id, name })
      .select("id")
      .single();
    if (error || !data) return { error: `تعذر إنشاء القسم "${name}": ${error?.message ?? ""}` };
    deptIdByName.set(name, data.id);
  }

  // 2) employees (real auth accounts - public.users is populated by the
  // on_auth_user_created trigger from this metadata, same as createEmployee())
  const adminClient = createAdminClient();
  const userIdByKey = new Map<string, string>();
  for (const emp of EMPLOYEES) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: emp.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        organization_id: profile.organization_id,
        role: emp.role,
        full_name: emp.full_name,
        department_id: deptIdByName.get(emp.dept) ?? null,
        job_title: emp.job_title,
        phone: null,
      },
    });
    if (error || !data.user) return { error: `تعذر إنشاء حساب "${emp.full_name}": ${error?.message ?? ""}` };
    userIdByKey.set(emp.key, data.user.id);
  }

  // 3) department managers
  for (const [deptName, empKey] of Object.entries(DEPT_MANAGER)) {
    await supabase
      .from("departments")
      .update({ manager_id: userIdByKey.get(empKey) })
      .eq("id", deptIdByName.get(deptName));
  }

  // 4) project
  const coordinatorId = userIdByKey.get("coordinator")!;
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      organization_id: profile.organization_id,
      department_id: deptIdByName.get("الإدارة والتنسيق"),
      manager_id: coordinatorId,
      name: PROJECT_NAME,
      description:
        "مشروع مقدَّم من المركز السعودي للثقافة والتراث، الشريك التنفيذي لمركز الملك سلمان للإغاثة والأعمال الإنسانية، لدعم التعافي الاقتصادي وبناء قدرات 1,000 مستفيد ومستفيدة من الفئات الأشد ضعفًا وذوي الإعاقة في قطاع غزة، عبر 8 مسارات تدريبية مهنية وتقنية، تزويدهم بأدوات المهنة، وربطهم بفرص دخل حقيقية ومستدامة، على مدى 12 شهرًا.",
      priority: "urgent",
      status: "active",
      start_date: "2026-03-01",
      due_date: "2027-02-28",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (projectError || !project) return { error: `تعذر إنشاء المشروع: ${projectError?.message ?? ""}` };
  const projectId = project.id;

  // 5) milestones
  const milestoneSeed = [
    { title: "مرحلة التحضير والتجهيز (الشهر الأول)", due_date: "2026-04-01", status: "completed" as const },
    { title: "مرحلة التنفيذ والتدريب (الأشهر 2-10)", due_date: "2026-12-01", status: "in_progress" as const },
    { title: "مرحلة المتابعة وقياس الأثر (الأشهر 6-11)", due_date: "2027-01-15", status: "pending" as const },
    { title: "مرحلة الإغلاق الإداري والمالي (الشهر 12)", due_date: "2027-02-28", status: "pending" as const },
  ];
  const milestoneIds: string[] = [];
  for (const [i, m] of milestoneSeed.entries()) {
    const { data, error } = await supabase
      .from("project_milestones")
      .insert({ project_id: projectId, title: m.title, due_date: m.due_date, status: m.status, position: i })
      .select("id")
      .single();
    if (error || !data) return { error: `تعذر إنشاء المرحلة "${m.title}": ${error?.message ?? ""}` };
    milestoneIds.push(data.id);
  }
  const [prepMilestone, implementMilestone, followUpMilestone, closeMilestone] = milestoneIds;

  // 6) tasks
  type TaskSeed = {
    title: string;
    assignee: string;
    milestone: string;
    due_date: string;
    priority: "low" | "medium" | "high" | "urgent";
    status: "new" | "in_progress" | "pending_review" | "completed";
  };
  const taskSeed: TaskSeed[] = [
    { title: "استكمال الترتيبات الإدارية والفنية واعتماد خطة التنفيذ التفصيلية", assignee: "coordinator", milestone: prepMilestone, due_date: "2026-03-10", priority: "high", status: "completed" },
    { title: "تجهيز وتهيئة المساحات التدريبية (كهرباء، إنترنت، تهوية)", assignee: "spaces_coordinator", milestone: prepMilestone, due_date: "2026-03-15", priority: "high", status: "completed" },
    { title: "تطوير المناهج التدريبية للمسارات الثمانية واعتمادها", assignee: "consultant", milestone: prepMilestone, due_date: "2026-03-20", priority: "high", status: "completed" },
    { title: "الإعلان عن المشروع وفتح باب التسجيل للمستفيدين", assignee: "admin_assist", milestone: prepMilestone, due_date: "2026-03-12", priority: "medium", status: "completed" },
    { title: "فرز طلبات المتقدمين وإجراء المقابلات والتقييمات الأولية", assignee: "field_team", milestone: prepMilestone, due_date: "2026-03-25", priority: "high", status: "completed" },
    { title: "التعاقد مع المدربين وتجهيز خطة التدريب الزمنية", assignee: "coordinator", milestone: prepMilestone, due_date: "2026-03-22", priority: "high", status: "completed" },
    { title: "إعداد مواصفات فنية لحقائب الأدوات المهنية وطرح طلب عروض أسعار", assignee: "finance", milestone: prepMilestone, due_date: "2026-03-18", priority: "medium", status: "completed" },
    { title: "شراء أدوات المهنة وتشكيل لجنة تقييم فنية ومالية", assignee: "finance", milestone: prepMilestone, due_date: "2026-03-28", priority: "high", status: "completed" },
    { title: "تجهيز 4 قاعات تدريبية وتوفير أثاث وأجهزة حاسوب", assignee: "spaces_coordinator", milestone: prepMilestone, due_date: "2026-03-30", priority: "medium", status: "completed" },

    { title: "تنفيذ مسار الحلاقة الرجالية (8 دورات، 200 مستفيد)", assignee: "trainer_vocational", milestone: implementMilestone, due_date: "2026-06-30", priority: "high", status: "completed" },
    { title: "تنفيذ مسار صناعة الإكسسوارات والأشغال اليدوية (8 دورات، 200 مستفيدة)", assignee: "trainer_vocational", milestone: implementMilestone, due_date: "2026-07-31", priority: "high", status: "in_progress" },
    { title: "تنفيذ مسار التجميل النسائي (8 دورات، 200 مستفيدة)", assignee: "trainer_beauty", milestone: implementMilestone, due_date: "2026-06-30", priority: "high", status: "completed" },
    { title: "تنفيذ مسار التطريز (8 دورات، 200 مستفيدة)", assignee: "trainer_beauty", milestone: implementMilestone, due_date: "2026-08-31", priority: "high", status: "in_progress" },
    { title: "تنفيذ مسار التصميم الجرافيكي (دورتان، 50 مستفيد)", assignee: "trainer_digital", milestone: implementMilestone, due_date: "2026-05-31", priority: "medium", status: "completed" },
    { title: "تنفيذ مسار التسويق الرقمي (دورتان، 50 مستفيد)", assignee: "trainer_digital", milestone: implementMilestone, due_date: "2026-07-15", priority: "medium", status: "in_progress" },
    { title: "تنفيذ مسار المساعد الافتراضي وإدارة الأعمال عن بُعد (دورتان، 50 مستفيد)", assignee: "trainer_digital", milestone: implementMilestone, due_date: "2026-09-15", priority: "medium", status: "new" },
    { title: "تسليم حقائب أدوات المهنة للمستفيدين", assignee: "field_team", milestone: implementMilestone, due_date: "2026-09-30", priority: "high", status: "in_progress" },
    { title: "تنفيذ مرحلة التشغيل التجريبي وربط المستفيدين بفرص عمل", assignee: "coordinator", milestone: implementMilestone, due_date: "2026-10-31", priority: "high", status: "new" },
    { title: "تقديم جلسات إرشاد فردي وجماعي للمستفيدين", assignee: "field_team", milestone: implementMilestone, due_date: "2026-10-15", priority: "medium", status: "new" },

    { title: "إجراء التقييم النصفي للمشروع (Mid-Term Evaluation)", assignee: "consultant", milestone: followUpMilestone, due_date: "2026-09-01", priority: "urgent", status: "in_progress" },
    { title: "متابعة الخريجين خلال مرحلة ما بعد التدريب", assignee: "field_team", milestone: followUpMilestone, due_date: "2026-11-30", priority: "medium", status: "new" },
    { title: "قياس مؤشرات الانتقال من المهارة إلى الدخل", assignee: "coordinator", milestone: followUpMilestone, due_date: "2026-12-15", priority: "high", status: "new" },
    { title: "توثيق قصص نجاح ونماذج تعلم مستفادة", assignee: "photographer", milestone: followUpMilestone, due_date: "2026-11-01", priority: "low", status: "new" },

    { title: "تنفيذ التقييم الختامي وقياس الأثر", assignee: "consultant", milestone: closeMilestone, due_date: "2027-02-15", priority: "urgent", status: "new" },
    { title: "إعداد التقرير الفني والمالي الختامي", assignee: "finance", milestone: closeMilestone, due_date: "2027-02-20", priority: "urgent", status: "new" },
    { title: "جرد الأصول والمعدات وتوثيقها", assignee: "spaces_coordinator", milestone: closeMilestone, due_date: "2027-02-10", priority: "medium", status: "new" },
    { title: "إعداد ملخص تنفيذي يبرز النتائج والتوصيات", assignee: "coordinator", milestone: closeMilestone, due_date: "2027-02-25", priority: "high", status: "new" },
  ];

  for (const t of taskSeed) {
    const { error } = await supabase.from("tasks").insert({
      organization_id: profile.organization_id,
      title: t.title,
      assigned_to: userIdByKey.get(t.assignee),
      created_by: profile.id,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
      project_id: projectId,
      milestone_id: t.milestone,
    });
    if (error) return { error: `تعذر إنشاء المهمة "${t.title}": ${error.message}` };
  }

  // 7) meetings
  const meetingSeed = [
    {
      title: "اجتماع افتتاحي لانطلاق المشروع",
      date: "2026-03-05",
      time: "10:00",
      location: "مقر المركز السعودي للثقافة والتراث - غزة",
      status: "completed" as const,
      attendees: Object.keys(DEPT_MANAGER).length ? [...userIdByKey.values()] : [],
    },
    {
      title: "اجتماع تنسيقي - متابعة سير التدريب",
      date: "2026-07-20",
      time: "11:00",
      location: "عبر الإنترنت (Google Meet)",
      status: "completed" as const,
      attendees: ["coordinator", "spaces_coordinator", "field_team", "trainer_vocational", "trainer_beauty", "trainer_digital"].map((k) => userIdByKey.get(k)!),
    },
    {
      title: "اجتماع مراجعة التقييم النصفي (Mid-Term)",
      date: "2026-09-01",
      time: "12:00",
      location: "مقر المركز السعودي للثقافة والتراث - غزة",
      status: "scheduled" as const,
      attendees: ["coordinator", "consultant", "finance", "spaces_coordinator"].map((k) => userIdByKey.get(k)!),
    },
    {
      title: "اجتماع الإغلاق وتسليم التقرير الختامي",
      date: "2027-02-25",
      time: "10:00",
      location: "مقر المركز السعودي للثقافة والتراث - غزة",
      status: "scheduled" as const,
      attendees: [...userIdByKey.values()],
    },
  ];

  for (const m of meetingSeed) {
    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({
        organization_id: profile.organization_id,
        organizer_id: coordinatorId,
        title: m.title,
        meeting_date: m.date,
        meeting_time: m.time,
        location: m.location,
        project_id: projectId,
        status: m.status,
      })
      .select("id")
      .single();
    if (error || !meeting) return { error: `تعذر إنشاء الاجتماع "${m.title}": ${error?.message ?? ""}` };

    if (m.attendees.length > 0) {
      await supabase
        .from("meeting_attendees")
        .insert(m.attendees.map((userId) => ({ meeting_id: meeting.id, user_id: userId })));
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/kanban");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/meetings");
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard/departments");

  return {
    summary: [
      `${DEPARTMENTS.length} أقسام`,
      `${EMPLOYEES.length} موظفين (كلمة المرور لجميع الحسابات التجريبية: ${DEMO_PASSWORD})`,
      `مشروع واحد (${PROJECT_NAME})`,
      `${milestoneSeed.length} مراحل`,
      `${taskSeed.length} مهمة`,
      `${meetingSeed.length} اجتماعات`,
    ],
  };
}
