export type InventoryTrack = {
  id: string;
  organization_id: string;
  name: string;
  responsible_user_id: string | null;
  project_id: string | null;
  created_at: string;
};

export type InventoryTool = {
  id: string;
  track_id: string;
  organization_id: string;
  name: string;
  unit: string | null;
  total_quantity: string | null;
  position: number;
  created_at: string;
};

export type InventoryDailyCheck = {
  id: string;
  tool_id: string;
  organization_id: string;
  check_date: string;
  morning_quantity: string | null;
  evening_quantity: string | null;
  actual_quantity: string | null;
  checked_by: string | null;
  updated_at: string;
};
