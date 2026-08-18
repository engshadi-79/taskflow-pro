export type InventoryItemType = "fixed" | "consumable";

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
  group_label: string | null;
  item_type: InventoryItemType;
  position: number;
  created_at: string;
};

export type InventoryDailyCheck = {
  id: string;
  tool_id: string;
  organization_id: string;
  check_date: string;
  // fixed tools only
  found_quantity: string | null;
  // consumables only
  opening_balance: string | null;
  used_quantity: string | null;
  damaged_lost_quantity: string | null;
  notes: string | null;
  checked_by: string | null;
  updated_at: string;
};
