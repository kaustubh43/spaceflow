import { create } from "zustand";
import { api } from "@/lib/api";
import { LAYERS } from "@/layers/config";
import type {
  CatalogItem,
  ElementKind,
  ElementModel,
  LayerType,
} from "@/types";

export type Tool =
  | "select"
  | "wall"
  | "room"
  | "place"
  | "comment"
  | "measure";

export type ViewMode = "2d" | "3d";

let tempId = -1; // negative ids for not-yet-saved elements

interface EditorState {
  projectId: number | null;
  floorId: number | null;
  elements: Record<number, ElementModel>;
  order: number[];
  selectedId: number | null;

  visibleLayers: Set<LayerType>;
  lockedLayers: Set<LayerType>;

  tool: Tool;
  placing: CatalogItem | null;
  view: ViewMode;
  showGrid: boolean;
  snap: boolean;

  dirty: Set<number>;
  deletes: Set<number>;
  saving: boolean;

  canEdit: boolean;
  isContributor: boolean;

  // actions
  load: (
    projectId: number,
    floorId: number,
    els: ElementModel[],
    canEdit: boolean,
    isContributor: boolean
  ) => void;
  setTool: (t: Tool) => void;
  setPlacing: (c: CatalogItem | null) => void;
  setView: (v: ViewMode) => void;
  toggleLayer: (l: LayerType) => void;
  toggleLock: (l: LayerType) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  select: (id: number | null) => void;

  addElement: (partial: Partial<ElementModel>) => number;
  updateElement: (id: number, patch: Partial<ElementModel>, markDirty?: boolean) => void;
  deleteElement: (id: number) => void;
  save: () => Promise<void>;
}

const allLayers = new Set<LayerType>(LAYERS.map((l) => l.type));

export const useEditor = create<EditorState>((set, get) => ({
  projectId: null,
  floorId: null,
  elements: {},
  order: [],
  selectedId: null,
  visibleLayers: new Set(allLayers),
  lockedLayers: new Set(),
  tool: "select",
  placing: null,
  view: "2d",
  showGrid: true,
  snap: true,
  dirty: new Set(),
  deletes: new Set(),
  saving: false,
  canEdit: false,
  isContributor: false,

  load: (projectId, floorId, els, canEdit, isContributor) => {
    const elements: Record<number, ElementModel> = {};
    const order: number[] = [];
    for (const e of els) {
      elements[e.id] = e;
      order.push(e.id);
    }
    set({
      projectId,
      floorId,
      elements,
      order,
      selectedId: null,
      dirty: new Set(),
      deletes: new Set(),
      canEdit,
      isContributor,
      tool: "select",
      placing: null,
    });
  },

  setTool: (t) => set({ tool: t, placing: t === "place" ? get().placing : null }),
  setPlacing: (c) => set({ placing: c, tool: c ? "place" : "select" }),
  setView: (v) => set({ view: v }),
  toggleLayer: (l) =>
    set((s) => {
      const next = new Set(s.visibleLayers);
      next.has(l) ? next.delete(l) : next.add(l);
      return { visibleLayers: next };
    }),
  toggleLock: (l) =>
    set((s) => {
      const next = new Set(s.lockedLayers);
      next.has(l) ? next.delete(l) : next.add(l);
      return { lockedLayers: next };
    }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  select: (id) => set({ selectedId: id }),

  addElement: (partial) => {
    const id = tempId--;
    const el: ElementModel = {
      id,
      floor_id: get().floorId!,
      kind: (partial.kind ?? "item") as ElementKind,
      layer: (partial.layer ?? "furniture") as LayerType,
      name: partial.name ?? "",
      x: partial.x ?? 0,
      y: partial.y ?? 0,
      width_cm: partial.width_cm ?? 60,
      depth_cm: partial.depth_cm ?? 60,
      height_cm: partial.height_cm ?? 90,
      rotation_deg: partial.rotation_deg ?? 0,
      points: partial.points ?? null,
      color: partial.color ?? null,
      z_index: partial.z_index ?? get().order.length,
      client_editable: partial.client_editable ?? false,
      catalog_item_id: partial.catalog_item_id ?? null,
      properties: partial.properties ?? {},
    };
    set((s) => ({
      elements: { ...s.elements, [id]: el },
      order: [...s.order, id],
      dirty: new Set(s.dirty).add(id),
      selectedId: id,
    }));
    return id;
  },

  updateElement: (id, patch, markDirty = true) =>
    set((s) => {
      const existing = s.elements[id];
      if (!existing) return {};
      const dirty = new Set(s.dirty);
      if (markDirty) dirty.add(id);
      return {
        elements: { ...s.elements, [id]: { ...existing, ...patch } },
        dirty,
      };
    }),

  deleteElement: (id) =>
    set((s) => {
      const elements = { ...s.elements };
      delete elements[id];
      const deletes = new Set(s.deletes);
      const dirty = new Set(s.dirty);
      dirty.delete(id);
      if (id > 0) deletes.add(id); // only server-persisted ids need deletion
      return {
        elements,
        order: s.order.filter((x) => x !== id),
        deletes,
        dirty,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  save: async () => {
    const { projectId, floorId, elements, dirty, deletes } = get();
    if (!projectId || !floorId) return;
    if (dirty.size === 0 && deletes.size === 0) return;
    set({ saving: true });

    const creates: any[] = [];
    const updates: Record<number, any> = {};
    for (const id of dirty) {
      const el = elements[id];
      if (!el) continue;
      const { id: _omit, floor_id: _f, ...body } = el;
      if (id < 0) creates.push(body);
      else updates[id] = body;
    }

    try {
      const { data } = await api.post<ElementModel[]>(
        `/projects/${projectId}/floors/${floorId}/elements/bulk`,
        { creates, updates, deletes: Array.from(deletes) }
      );
      const next: Record<number, ElementModel> = {};
      const order: number[] = [];
      for (const e of data) {
        next[e.id] = e;
        order.push(e.id);
      }
      set({
        elements: next,
        order,
        dirty: new Set(),
        deletes: new Set(),
        saving: false,
        selectedId: null,
      });
    } catch (e) {
      set({ saving: false });
      throw e;
    }
  },
}));
