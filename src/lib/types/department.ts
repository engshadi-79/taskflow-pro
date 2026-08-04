export type Department = {
  id: string;
  organization_id: string;
  name: string;
  manager_id: string | null;
  created_at: string;
};

export type DepartmentWithManager = Department & {
  manager: { id: string; full_name: string } | null;
};
