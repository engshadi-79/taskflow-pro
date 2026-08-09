export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled" | "archived";
export type MilestoneStatus = "pending" | "in_progress" | "completed";
export type DependencyType = "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";

export type Project = {
  id: string;
  organization_id: string;
  department_id: string | null;
  manager_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  added_at: string;
};

export type ProjectWithManager = Project & {
  manager: { id: string; full_name: string } | null;
  department: { id: string; name: string } | null;
};

export type ProjectMemberWithUser = ProjectMember & {
  user: { id: string; full_name: string; avatar_url: string | null } | null;
};

export type ProjectTaskStats = {
  total_count: number;
  completed_count: number;
  in_progress_count: number;
  overdue_count: number;
  completion_rate: number;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  status: MilestoneStatus;
  position: number;
  created_at: string;
};

export type TaskDependency = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: DependencyType;
  created_at: string;
};

export type TaskChecklistItem = {
  id: string;
  task_id: string;
  content: string;
  is_completed: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
};

export type TaskWatcher = {
  id: string;
  task_id: string;
  user_id: string;
  created_at: string;
};

export type Label = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type TaskLabel = {
  task_id: string;
  label_id: string;
};

export type TaskTimeEntry = {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  created_at: string;
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "قيد التخطيط",
  active: "نشط",
  on_hold: "معلّق",
  completed: "مكتمل",
  cancelled: "ملغى",
  archived: "مؤرشف",
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending: "لم يبدأ",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
};

export const DEPENDENCY_TYPE_LABEL: Record<DependencyType, string> = {
  finish_to_start: "ينتهي ثم يبدأ التالي",
  start_to_start: "يبدآن معًا",
  finish_to_finish: "ينتهيان معًا",
  start_to_finish: "ينتهي الأول ليبدأ إنهاء الثاني",
};
