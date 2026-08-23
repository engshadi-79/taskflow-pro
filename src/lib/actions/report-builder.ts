"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { can } from "@/lib/foundation/permissions";
import {
  REPORT_SOURCES,
  isSourceKey,
  getField,
  validateFieldKeys,
  OPERATORS_BY_TYPE,
  type SourceKey,
  type ReportField,
  type ReportFilter,
  type FilterOperator,
} from "@/lib/reports/report-fields-registry";

/** Hard cap on rows pulled per report run - this is an internal reporting
 *  tool over an org's own data, not an export pipeline; large orgs still
 *  get a useful (if truncated) report instead of an unbounded query. */
const ROW_CAP = 2000;

export type AggregateFn = "sum" | "avg";
export type ChartType = "table" | "bar";

export type RunReportInput = {
  source: string;
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  aggregate?: { field: string; fn: AggregateFn };
};

export type ReportRow = Record<string, string | number | boolean | null>;
export type GroupedRow = { name: string; count: number; aggregate?: number };

export type RunReportResult =
  | { error: string }
  | {
      rows: ReportRow[];
      rowCount: number;
      truncated: boolean;
      grouped?: GroupedRow[];
      fields: ReportField[];
    };

/**
 * Runs under the caller's own session (createClient(), not the admin
 * client) so every one of the app's existing RLS policies applies exactly
 * as it would to any other query - a report builder is not a service-role
 * bypass. Column names never come from the client directly: every field/
 * filter/group key is re-resolved against REPORT_SOURCES first.
 */
export async function runReport(input: RunReportInput): Promise<RunReportResult> {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return { error: "غير مصرح لك بإنشاء تقارير مخصّصة" };
  }

  if (!isSourceKey(input.source)) return { error: "مصدر بيانات غير معروف" };
  const source = REPORT_SOURCES[input.source];

  let displayFields: ReportField[];
  try {
    displayFields = validateFieldKeys(input.source, input.fields);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "حقول غير صالحة" };
  }
  if (displayFields.length === 0) return { error: "اختر حقلًا واحدًا على الأقل" };

  const resolvedFilters: { column: string; op: FilterOperator; value: string; type: ReportField["type"] }[] = [];
  for (const f of input.filters) {
    if (f.value === "" || f.value == null) continue;
    const field = getField(input.source, f.field);
    if (!field || !field.filterable) return { error: `حقل فلترة غير صالح: ${f.field}` };
    const allowed = OPERATORS_BY_TYPE[field.type].map((o) => o.value);
    if (!allowed.includes(f.op)) return { error: `عامل غير صالح لحقل ${field.label}` };
    resolvedFilters.push({ column: field.column, op: f.op, value: f.value, type: field.type });
  }

  let groupField: ReportField | undefined;
  if (input.groupBy) {
    groupField = getField(input.source, input.groupBy);
    if (!groupField || !groupField.groupable) return { error: "حقل تجميع غير صالح" };
  }

  let aggregateField: ReportField | undefined;
  if (input.aggregate) {
    aggregateField = getField(input.source, input.aggregate.field);
    if (!aggregateField || !aggregateField.aggregatable) return { error: "حقل تجميع رقمي غير صالح" };
  }

  const columns = new Set<string>(displayFields.map((f) => f.column));
  if (groupField) columns.add(groupField.column);
  if (aggregateField) columns.add(aggregateField.column);

  const supabase = await createClient();
  let query = supabase.from(source.table).select([...columns].join(","));

  for (const f of resolvedFilters) {
    const value: string | number | boolean =
      f.type === "number" ? Number(f.value) : f.type === "boolean" ? f.value === "true" : f.value;
    if (f.op === "eq") query = query.eq(f.column, value);
    else if (f.op === "neq") query = query.neq(f.column, value);
    else if (f.op === "gt") query = query.gt(f.column, value);
    else if (f.op === "gte") query = query.gte(f.column, value);
    else if (f.op === "lt") query = query.lt(f.column, value);
    else if (f.op === "lte") query = query.lte(f.column, value);
    else if (f.op === "contains") query = query.ilike(f.column, `%${value}%`);
  }

  const { data, error } = await query.limit(ROW_CAP + 1);
  if (error) return { error: "تعذر تنفيذ الاستعلام - تحقق من الفلاتر المستخدمة" };

  const truncated = (data?.length ?? 0) > ROW_CAP;
  const rawRows = (data ?? []).slice(0, ROW_CAP) as unknown as Record<string, unknown>[];

  // Foreign-key fields (assigned_to, department_id, ...) are resolved to a
  // friendly label via a separate lookup query per referenced table/column,
  // never via a join in the main query - keeps the single-source-per-report
  // security model intact while still showing names instead of raw ids.
  const lookupFields = [...displayFields, ...(groupField ? [groupField] : [])].filter((f) => f.lookup);
  const labelMaps = new Map<string, Map<string, string>>();

  for (const field of lookupFields) {
    const lookup = field.lookup!;
    const cacheKey = `${lookup.table}:${lookup.labelColumn}`;
    if (labelMaps.has(cacheKey)) continue;

    const ids = [...new Set(rawRows.map((r) => r[field.column]).filter((v): v is string => Boolean(v)))];
    const map = new Map<string, string>();
    if (ids.length > 0) {
      const { data: labelRows } = await supabase
        .from(lookup.table)
        .select(`id, ${lookup.labelColumn}`)
        .in("id", ids);
      for (const row of (labelRows ?? []) as unknown as Record<string, unknown>[]) {
        map.set(String(row.id), String(row[lookup.labelColumn] ?? ""));
      }
    }
    labelMaps.set(cacheKey, map);
  }

  function resolveValue(field: ReportField, raw: unknown): string | number | boolean | null {
    if (raw == null) return null;
    if (field.lookup) {
      const map = labelMaps.get(`${field.lookup.table}:${field.lookup.labelColumn}`);
      return map?.get(String(raw)) ?? String(raw);
    }
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
    return String(raw);
  }

  const rows: ReportRow[] = rawRows.map((raw) => {
    const row: ReportRow = {};
    for (const field of displayFields) row[field.key] = resolveValue(field, raw[field.column]);
    return row;
  });

  let grouped: GroupedRow[] | undefined;
  if (groupField) {
    const buckets = new Map<string, { count: number; sum: number }>();
    for (const raw of rawRows) {
      const label = String(resolveValue(groupField, raw[groupField.column]) ?? "—");
      const bucket = buckets.get(label) ?? { count: 0, sum: 0 };
      bucket.count += 1;
      if (aggregateField) {
        const n = Number(raw[aggregateField.column]);
        if (!Number.isNaN(n)) bucket.sum += n;
      }
      buckets.set(label, bucket);
    }
    grouped = [...buckets.entries()]
      .map(([name, b]) => ({
        name,
        count: b.count,
        aggregate: aggregateField
          ? input.aggregate!.fn === "avg"
            ? b.count > 0
              ? Math.round((b.sum / b.count) * 100) / 100
              : 0
            : b.sum
          : undefined,
      }))
      .sort((a, b) => b.count - a.count);
  }

  return { rows, rowCount: rawRows.length, truncated, grouped, fields: displayFields };
}

export type SaveReportInput = {
  name: string;
  source: string;
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  aggregate?: { field: string; fn: AggregateFn };
  chartType: ChartType;
};

export type SaveReportResult = { error?: string; id?: string };

export async function saveReportDefinition(input: SaveReportInput): Promise<SaveReportResult> {
  const profile = await getCurrentProfile();
  if (!profile || !can.buildReports(profile)) {
    return { error: "غير مصرح لك بحفظ التقارير" };
  }
  if (!input.name.trim()) return { error: "اسم التقرير مطلوب" };
  if (!isSourceKey(input.source)) return { error: "مصدر بيانات غير معروف" };

  try {
    validateFieldKeys(input.source, input.fields);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "حقول غير صالحة" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_definitions")
    .insert({
      organization_id: profile.organization_id,
      created_by: profile.id,
      name: input.name.trim(),
      source_entity: input.source,
      selected_fields: input.fields,
      filters: input.filters,
      group_by: input.groupBy || null,
      aggregate: input.aggregate || null,
      chart_type: input.chartType,
    })
    .select("id")
    .single();

  if (error) return { error: "تعذر حفظ التقرير" };
  revalidatePath("/dashboard/reports/builder");
  return { id: data.id as string };
}

export type SavedReportRow = {
  id: string;
  name: string;
  source_entity: SourceKey;
  selected_fields: string[];
  filters: ReportFilter[];
  group_by: string | null;
  aggregate: { field: string; fn: AggregateFn } | null;
  chart_type: ChartType;
  created_at: string;
};

export async function listReportDefinitions(): Promise<SavedReportRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("report_definitions")
    .select("id, name, source_entity, selected_fields, filters, group_by, aggregate, chart_type, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []) as SavedReportRow[];
}

export async function deleteReportDefinition(id: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "يجب تسجيل الدخول" };

  const supabase = await createClient();
  const { error } = await supabase.from("report_definitions").delete().eq("id", id);
  if (error) return { error: "تعذر حذف التقرير" };

  revalidatePath("/dashboard/reports/builder");
  return {};
}
