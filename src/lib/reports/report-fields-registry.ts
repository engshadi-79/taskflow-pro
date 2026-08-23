/**
 * سجل الحقول القابلة للتقرير — مصدر الحقيقة الوحيد لما يظهر في واجهة
 * "منشئ التقارير" وما يُسمح باستخدامه عند بناء الاستعلام الديناميكي.
 *
 * `column` هنا allow-list صريح لأسماء الأعمدة الفعلية في قاعدة البيانات
 * (تم التحقق منها مقابل supabase/schema.sql وملفات الهجرة الفعلية، وليست
 * تخمينًا). أي حقل غير موجود هنا يُرفض في طبقة الخادم
 * (src/lib/actions/report-builder.ts) — هذا ما يمنع حقن SQL عبر مدخلات
 * المستخدم، لأننا لا نُدخل أسماء أعمدة من المستخدم مباشرة إلى الاستعلام.
 *
 * لا يدعم الإصدار الحالي الربط الديناميكي بين عدة جداول (joins) عمدًا -
 * تقرير واحد = مصدر واحد، لتفادي بناء SQL ديناميكي غير آمن. حقول المفاتيح
 * الأجنبية (department_id, assigned_to, ...) تُعرض كأسماء صديقة عبر
 * `lookup` (استعلام بحث منفصل بعد الجلب، وليس join)، لا كمعرّفات خام.
 */

export type FieldType = "text" | "number" | "date" | "enum" | "boolean";

/** بعد جلب الصفوف، يُستبدل معرّف هذا الحقل باسمه الصديق عبر استعلام بحث
 *  منفصل على جدول lookup - وليس عبر join في نفس الاستعلام. */
export interface FieldLookup {
  table: "departments" | "users";
  labelColumn: string;
}

export interface ReportField {
  key: string;
  label: string;
  column: string;
  type: FieldType;
  filterable?: boolean;
  groupable?: boolean;
  aggregatable?: boolean;
  lookup?: FieldLookup;
}

export interface ReportSource {
  label: string;
  table: string;
  fields: ReportField[];
}

export const REPORT_SOURCES: Record<string, ReportSource> = {
  tasks: {
    label: "المهام",
    table: "tasks",
    fields: [
      { key: "title", label: "العنوان", column: "title", type: "text", filterable: true },
      { key: "status", label: "الحالة", column: "status", type: "enum", filterable: true, groupable: true },
      { key: "priority", label: "الأولوية", column: "priority", type: "enum", filterable: true, groupable: true },
      {
        key: "assignee",
        label: "المكلّف",
        column: "assigned_to",
        type: "text",
        filterable: true,
        groupable: true,
        lookup: { table: "users", labelColumn: "full_name" },
      },
      { key: "due_date", label: "تاريخ الاستحقاق", column: "due_date", type: "date", filterable: true },
      { key: "created_at", label: "تاريخ الإنشاء", column: "created_at", type: "date", filterable: true },
      {
        key: "estimated_hours",
        label: "الساعات المقدّرة",
        column: "estimated_hours",
        type: "number",
        filterable: true,
        aggregatable: true,
      },
    ],
  },
  employees: {
    label: "الموظفون",
    table: "users",
    fields: [
      { key: "name", label: "الاسم", column: "full_name", type: "text", filterable: true },
      { key: "job_title", label: "المسمى الوظيفي", column: "job_title", type: "text", filterable: true },
      {
        key: "department",
        label: "القسم",
        column: "department_id",
        type: "enum",
        filterable: true,
        groupable: true,
        lookup: { table: "departments", labelColumn: "name" },
      },
      { key: "role", label: "الدور", column: "role", type: "enum", filterable: true, groupable: true },
      { key: "status", label: "نشط؟", column: "is_active", type: "boolean", filterable: true, groupable: true },
      { key: "join_date", label: "تاريخ الالتحاق", column: "created_at", type: "date", filterable: true },
    ],
  },
  departments: {
    label: "الأقسام",
    table: "departments",
    fields: [
      { key: "name", label: "اسم القسم", column: "name", type: "text", filterable: true },
      {
        key: "manager",
        label: "المدير",
        column: "manager_id",
        type: "text",
        filterable: true,
        lookup: { table: "users", labelColumn: "full_name" },
      },
    ],
  },
  projects: {
    label: "المشاريع",
    table: "projects",
    fields: [
      { key: "name", label: "اسم المشروع", column: "name", type: "text", filterable: true },
      {
        key: "department",
        label: "القسم",
        column: "department_id",
        type: "enum",
        filterable: true,
        groupable: true,
        lookup: { table: "departments", labelColumn: "name" },
      },
      { key: "status", label: "الحالة", column: "status", type: "enum", filterable: true, groupable: true },
      { key: "start_date", label: "تاريخ البدء", column: "start_date", type: "date", filterable: true },
      { key: "due_date", label: "تاريخ الانتهاء", column: "due_date", type: "date", filterable: true },
    ],
  },
  workflow_requests: {
    label: "الطلبات الإدارية",
    table: "workflow_requests",
    fields: [
      { key: "status", label: "الحالة", column: "status", type: "enum", filterable: true, groupable: true },
      {
        key: "requester",
        label: "مقدّم الطلب",
        column: "requested_by",
        type: "text",
        filterable: true,
        groupable: true,
        lookup: { table: "users", labelColumn: "full_name" },
      },
      { key: "created_at", label: "تاريخ التقديم", column: "created_at", type: "date", filterable: true },
    ],
  },
  kpi: {
    label: "تقييمات الأداء",
    table: "employee_kpi_evaluations",
    fields: [
      {
        key: "employee",
        label: "الموظف",
        column: "user_id",
        type: "text",
        filterable: true,
        groupable: true,
        lookup: { table: "users", labelColumn: "full_name" },
      },
      { key: "period_start", label: "بداية الفترة", column: "period_start", type: "date", filterable: true },
      { key: "period_end", label: "نهاية الفترة", column: "period_end", type: "date", filterable: true },
      {
        key: "completion_score",
        label: "درجة الإنجاز",
        column: "completion_score",
        type: "number",
        filterable: true,
        aggregatable: true,
      },
      {
        key: "on_time_score",
        label: "درجة الالتزام بالوقت",
        column: "on_time_score",
        type: "number",
        filterable: true,
        aggregatable: true,
      },
      {
        key: "quality_score",
        label: "درجة الجودة",
        column: "quality_score",
        type: "number",
        filterable: true,
        aggregatable: true,
      },
      {
        key: "total_score",
        label: "الدرجة الإجمالية",
        column: "total_score",
        type: "number",
        filterable: true,
        aggregatable: true,
      },
      { key: "status", label: "الحالة", column: "status", type: "enum", filterable: true, groupable: true },
    ],
  },
};

export type SourceKey = keyof typeof REPORT_SOURCES;

export const SOURCE_KEYS = Object.keys(REPORT_SOURCES) as SourceKey[];

export function isSourceKey(value: string): value is SourceKey {
  return value in REPORT_SOURCES;
}

export function getReportableFields(source: SourceKey): ReportField[] {
  return REPORT_SOURCES[source]?.fields ?? [];
}

export function getField(source: SourceKey, key: string): ReportField | undefined {
  return getReportableFields(source).find((f) => f.key === key);
}

/** يتحقق أن كل مفتاح حقل مطلوب من المستخدم موجود فعليًا في السجل قبل بناء أي استعلام. */
export function validateFieldKeys(source: SourceKey, keys: string[]): ReportField[] {
  const fields = getReportableFields(source);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const resolved: ReportField[] = [];
  const invalid: string[] = [];
  for (const key of keys) {
    const field = byKey.get(key);
    if (field) resolved.push(field);
    else invalid.push(key);
  }
  if (invalid.length > 0) {
    throw new Error(`حقول غير معروفة للمصدر "${source}": ${invalid.join(", ")}`);
  }
  return resolved;
}

export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

/** العوامل المسموحة لكل نوع حقل - نفس القائمة تُستخدم في الواجهة وفي
 *  التحقق داخل الخادم، بحيث لا يمكن إرسال عامل غير منطقي لنوع حقل معين. */
export const OPERATORS_BY_TYPE: Record<FieldType, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: "contains", label: "يحتوي" },
    { value: "eq", label: "يساوي" },
  ],
  enum: [
    { value: "eq", label: "يساوي" },
    { value: "neq", label: "لا يساوي" },
  ],
  boolean: [{ value: "eq", label: "يساوي" }],
  number: [
    { value: "gt", label: "أكبر من" },
    { value: "gte", label: "أكبر أو يساوي" },
    { value: "lt", label: "أصغر من" },
    { value: "lte", label: "أصغر أو يساوي" },
    { value: "eq", label: "يساوي" },
  ],
  date: [
    { value: "gt", label: "بعد" },
    { value: "gte", label: "بعد أو في" },
    { value: "lt", label: "قبل" },
    { value: "lte", label: "قبل أو في" },
  ],
};

export interface ReportFilter {
  field: string;
  op: FilterOperator;
  value: string;
}
