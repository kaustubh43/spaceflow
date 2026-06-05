export type UserRole = "designer" | "client";
export type MembershipRole = "owner" | "editor" | "contributor" | "viewer";

export type LayerType =
  | "architecture"
  | "furniture"
  | "appliances"
  | "electrical"
  | "plumbing"
  | "lighting"
  | "hvac"
  | "networking"
  | "false_ceiling"
  | "flooring"
  | "annotations";

export type ElementKind =
  | "wall"
  | "room"
  | "door"
  | "window"
  | "item"
  | "switchboard"
  | "electrical_point"
  | "plumbing_line"
  | "plumbing_fixture"
  | "light"
  | "hvac_unit"
  | "network_point"
  | "annotation";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface Membership {
  id: number;
  user: User;
  role: MembershipRole;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  address?: string | null;
  client_name?: string | null;
  units: string;
  owner_id: number;
  thumbnail_path?: string | null;
  my_role?: MembershipRole | null;
  memberships?: Membership[];
}

export interface Floor {
  id: number;
  project_id: number;
  name: string;
  level: number;
  width_cm: number;
  height_cm: number;
  grid_cm: number;
  wall_height_cm: number;
}

export interface ElementModel {
  id: number;
  floor_id: number;
  kind: ElementKind;
  layer: LayerType;
  name: string;
  x: number;
  y: number;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  rotation_deg: number;
  points?: number[] | null;
  color?: string | null;
  z_index: number;
  client_editable: boolean;
  catalog_item_id?: number | null;
  properties: Record<string, any>;
}

export interface CatalogItem {
  id: number;
  name: string;
  category: string;
  layer: LayerType;
  kind: ElementKind;
  default_width_cm: number;
  default_depth_cm: number;
  default_height_cm: number;
  color: string;
  icon?: string | null;
  unit_cost: number;
  default_properties: Record<string, any>;
}

export interface Comment {
  id: number;
  floor_id: number;
  element_id?: number | null;
  author: User;
  body: string;
  x?: number | null;
  y?: number | null;
  resolved: boolean;
}

export interface Snapshot {
  id: number;
  project_id: number;
  label: string;
  author?: User | null;
}

export interface BOMLine {
  name: string;
  category: string;
  layer: LayerType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface BOMReport {
  lines: BOMLine[];
  grand_total: number;
}

export interface SwitchButton {
  label: string;
  type: string;
}
