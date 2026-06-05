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
  | "door"
  | "window"
  | "place"
  | "comment"
  | "measure";

export type ViewMode = "2d" | "3d";

let tempId = -1; // negative ids for not-yet-saved elements

interface HistorySnap {
  elements: Record<number, ElementModel>;
  order: number[];
  dirty: number[];
  deletes: number[];
  selectedId: number | null;
}
const HISTORY_LIMIT = 60;
const COALESCE_MS = 500;

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
  placeExisting: boolean; // place the next item as an existing (not charged) item
  view: ViewMode;
  showGrid: boolean;
  snap: boolean;

  dirty: Set<number>;
  deletes: Set<number>;
  saving: boolean;

  past: HistorySnap[];
  future: HistorySnap[];
  lastTouch: { id: number; t: number } | null;

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
  setPlaceExisting: (v: boolean) => void;
  setView: (v: ViewMode) => void;
  toggleLayer: (l: LayerType) => void;
  toggleLock: (l: LayerType) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  select: (id: number | null) => void;

  addElement: (partial: Partial<ElementModel>) => number;
  updateElement: (id: number, patch: Partial<ElementModel>, markDirty?: boolean) => void;
  deleteElement: (id: number) => void;
  undo: () => void;
  redo: () => void;
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
  placeExisting: false,
  view: "2d",
  showGrid: true,
  snap: true,
  dirty: new Set(),
  deletes: new Set(),
  saving: false,
  past: [],
  future: [],
  lastTouch: null,
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
      past: [],
      future: [],
      lastTouch: null,
      canEdit,
      isContributor,
      tool: "select",
      placing: null,
    });
  },

  setTool: (t) => set({ tool: t, placing: t === "place" ? get().placing : null }),
  setPlacing: (c) => set({ placing: c, tool: c ? "place" : "select" }),
  setPlaceExisting: (v) => set({ placeExisting: v }),
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
    recordHistory(get, set);
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
      is_existing: partial.is_existing ?? false,
      unit_cost_override: partial.unit_cost_override ?? null,
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

  updateElement: (id, patch, markDirty = true) => {
    if (markDirty) recordHistory(get, set, id); // coalesce rapid edits to same element
    set((s) => {
      const existing = s.elements[id];
      if (!existing) return {};
      const dirty = new Set(s.dirty);
      if (markDirty) dirty.add(id);
      return {
        elements: { ...s.elements, [id]: { ...existing, ...patch } },
        dirty,
      };
    });
  },

  deleteElement: (id) => {
    recordHistory(get, set);
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
    });
  },

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const prev = s.past[s.past.length - 1];
    const current = snapshotOf(s);
    set({
      ...restoreSnap(prev),
      past: s.past.slice(0, -1),
      future: [current, ...s.future].slice(0, HISTORY_LIMIT),
      lastTouch: null,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    const current = snapshotOf(s);
    set({
      ...restoreSnap(next),
      past: [...s.past, current].slice(-HISTORY_LIMIT),
      future: s.future.slice(1),
      lastTouch: null,
    });
  },

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

// ---- undo/redo helpers ----
function snapshotOf(s: EditorState): HistorySnap {
  return {
    elements: { ...s.elements },
    order: [...s.order],
    dirty: Array.from(s.dirty),
    deletes: Array.from(s.deletes),
    selectedId: s.selectedId,
  };
}

function restoreSnap(snap: HistorySnap) {
  return {
    elements: { ...snap.elements },
    order: [...snap.order],
    dirty: new Set(snap.dirty),
    deletes: new Set(snap.deletes),
    selectedId: snap.selectedId,
  };
}

/** Push the pre-mutation state onto the undo stack. When `coalesceId` is given,
 * rapid consecutive edits to the same element collapse into one undo step. */
function recordHistory(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  coalesceId?: number
) {
  const s = get();
  const now = Date.now();
  if (
    coalesceId !== undefined &&
    s.lastTouch &&
    s.lastTouch.id === coalesceId &&
    now - s.lastTouch.t < COALESCE_MS
  ) {
    set({ lastTouch: { id: coalesceId, t: now } });
    return;
  }
  set({
    past: [...s.past, snapshotOf(s)].slice(-HISTORY_LIMIT),
    future: [],
    lastTouch: coalesceId !== undefined ? { id: coalesceId, t: now } : null,
  });
}
