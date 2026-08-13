import type { Priority } from "@/lib/types/task";

export type Organization = {
  id: string;
  name: string;
  plan_type: "free" | "paid";
  logo_url: string | null;
  timezone: string;
  work_days: number[];
  work_start_time: string;
  work_end_time: string;
  default_task_priority: Priority;
  default_sla_hours: number;
  created_at: string;
};

export type OrganizationHoliday = {
  id: string;
  organization_id: string;
  holiday_date: string;
  name: string;
  created_at: string;
};

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Riyadh", label: "الرياض (GMT+3)" },
  { value: "Asia/Kuwait", label: "الكويت (GMT+3)" },
  { value: "Asia/Qatar", label: "الدوحة (GMT+3)" },
  { value: "Asia/Bahrain", label: "المنامة (GMT+3)" },
  { value: "Asia/Dubai", label: "دبي/أبوظبي (GMT+4)" },
  { value: "Asia/Muscat", label: "مسقط (GMT+4)" },
  { value: "Asia/Baghdad", label: "بغداد (GMT+3)" },
  { value: "Asia/Amman", label: "عمّان (GMT+3)" },
  { value: "Asia/Beirut", label: "بيروت (GMT+2/3)" },
  { value: "Asia/Damascus", label: "دمشق (GMT+3)" },
  { value: "Africa/Cairo", label: "القاهرة (GMT+2)" },
  { value: "Africa/Casablanca", label: "الدار البيضاء (GMT+1)" },
  { value: "Africa/Tunis", label: "تونس (GMT+1)" },
  { value: "Africa/Algiers", label: "الجزائر (GMT+1)" },
  { value: "UTC", label: "التوقيت العالمي (UTC)" },
];

export const WEEKDAY_LABELS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
