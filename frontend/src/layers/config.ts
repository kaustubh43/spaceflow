import {
  Armchair,
  Blinds,
  Cctv,
  Layers,
  Lightbulb,
  Plug,
  Droplets,
  Wind,
  Refrigerator,
  Ruler,
  Grid3x3,
  type LucideIcon,
} from "lucide-react";
import type { LayerType } from "@/types";

export interface LayerDef {
  type: LayerType;
  label: string;
  color: string;
  icon: LucideIcon;
  base?: boolean; // base layers can't be removed; always present
}

export const LAYERS: LayerDef[] = [
  { type: "architecture", label: "Architecture", color: "#334155", icon: Layers, base: true },
  { type: "furniture", label: "Furniture", color: "#92400e", icon: Armchair, base: true },
  { type: "appliances", label: "Appliances", color: "#475569", icon: Refrigerator },
  { type: "electrical", label: "Electrical", color: "#f59e0b", icon: Plug },
  { type: "plumbing", label: "Plumbing", color: "#0ea5e9", icon: Droplets },
  { type: "lighting", label: "Lighting", color: "#eab308", icon: Lightbulb },
  { type: "hvac", label: "HVAC", color: "#10b981", icon: Wind },
  { type: "networking", label: "Networking / Security", color: "#8b5cf6", icon: Cctv },
  { type: "false_ceiling", label: "False Ceiling", color: "#64748b", icon: Grid3x3 },
  { type: "flooring", label: "Flooring", color: "#a16207", icon: Blinds },
  { type: "annotations", label: "Annotations", color: "#ef4444", icon: Ruler },
];

export const LAYER_MAP: Record<LayerType, LayerDef> = Object.fromEntries(
  LAYERS.map((l) => [l.type, l])
) as Record<LayerType, LayerDef>;

export function layerColor(layer: LayerType): string {
  return LAYER_MAP[layer]?.color ?? "#64748b";
}
