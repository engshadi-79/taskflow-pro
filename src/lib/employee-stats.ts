export type EmployeeStats = {
  taskCount: number;
  completionRate: number;
  avgDays: number;
};

type TaskForStats = {
  assigned_to: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export function computeEmployeeStats(tasks: TaskForStats[], employeeId: string): EmployeeStats {
  const empTasks = tasks.filter((t) => t.assigned_to === employeeId && t.status !== "cancelled");
  const completed = empTasks.filter((t) => t.status === "completed");

  const taskCount = empTasks.length;
  const completionRate = taskCount > 0 ? Math.round((completed.length / taskCount) * 100) : 0;
  const avgDays =
    completed.length > 0
      ? Math.round(
          (completed.reduce(
            (sum, t) =>
              sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86400000,
            0
          ) /
            completed.length) *
            10
        ) / 10
      : 0;

  return { taskCount, completionRate, avgDays };
}
