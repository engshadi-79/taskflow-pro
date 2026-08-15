export type Role = "super_admin" | "department_manager" | "employee";

export type Profile = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  secondary_email: string | null;
  bio: string | null;
  role: Role;
  department_id: string | null;
  job_title: string | null;
  manager_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  dashboard_shortcuts: { id: string; href: string; label: string; iconKey: string }[] | null;
  /** Effective permission keys (role default + user overrides), computed
   * server-side by get_user_permissions() - see src/lib/foundation/permissions.ts. */
  permissionKeys: string[];
};
