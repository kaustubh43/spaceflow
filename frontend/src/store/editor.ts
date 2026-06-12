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
  selectedId: number | null;
}
const HISTORY_LIMIT = 60;
const PERSIST_HISTORY = 30; // cap snapshots written to localStorage
const COALESCE_MS = 500;
const AUTOSAVE_MS = 1200;
const STORAGE_PREFIX = "idesigner_editor_";

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

interface EditorState {
  projectId: number | null;
  floorId: number | null;
  elements: Record<number, ElementModel>;
  order: number[];
  selectedId: number | null; // primary selection (drives the Properties panel)
  selectedIds: number[]; // full multi-selection (includes selectedId)
  baseline: Record<number, ElementModel>; // last known server state, for diffing

  visibleLayers: Set<LayerType>;
  lockedLayers: Set<LayerType>;

  tool: Tool;
  placing: CatalogItem | null;
  placeExisting: boolean; // place the next item as an existing (not charged) item
  view: ViewMode;
  showGrid: boolean;
  snap: boolean;

  dirty: Set<number>; // derived cache (for the unsaved-count UI)
  deletes: Set<number>; // derived cache
  saving: boolean;
  autoSave: boolean;
  lastSavedAt: number | null;
  saveError: boolean;

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
  toggleAutoSave: () => void;
  select: (id: number | null) => void;
  toggleSelect: (id: number) => void; // shift-click add/remove
  selectAll: () => void; // every element on visible, unlocked layers
  moveSelection: (ids: number[], dx: number, dy: number) => void; // group drag commit

  addElement: (partial: Partial<ElementModel>) => number;
  updateElement: (id: number, patch: Partial<ElementModel>, markDirty?: boolean) => void;
  deleteElement: (id: number) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
}

const allLayers = new Set<LayerType>(LAYERS.map((l) => l.type));

// dev-only handle for debugging / automated tests (stripped from prod builds)
declare global {
  interface Window {
    __editor?: typeof useEditor;
  }
}

export const useEditor = create<EditorState>((set, get) => ({
  projectId: null,
  floorId: null,
  elements: {},
  order: [],
  selectedId: null,
  selectedIds: [],
  baseline: {},
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
  autoSave: true,
  lastSavedAt: null,
  saveError: false,
  past: [],
  future: [],
  lastTouch: null,
  canEdit: false,
  isContributor: false,

  load: (projectId, floorId, els, canEdit, isContributor) => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    const elements: Record<number, ElementModel> = {};
    const order: number[] = [];
    for (const e of els) {
      elements[e.id] = e;
      order.push(e.id);
    }
    const baseline = deepCopy(elements);

    // restore unsaved edits + undo history for this floor, but only if the
    // server still matches the baseline we last saw (otherwise it changed
    // elsewhere and the local history would be inconsistent).
    const persisted = loadPersisted(projectId, floorId);
    if (persisted && elementsEqual(persisted.baseline, elements)) {
      tempId = Math.min(tempId, minId(persisted) - 1, -1);
      set({
        projectId,
        floorId,
        elements: persisted.elements,
        order: persisted.order,
        baseline,
        past: persisted.past ?? [],
        future: persisted.future ?? [],
        selectedId: null,
        selectedIds: [],
        lastTouch: null,
        canEdit,
        isContributor,
        tool: "select",
        placing: null,
        saveError: false,
      });
      refreshDirty(get, set);
    } else {
      if (persisted) clearPersisted(projectId, floorId);
      set({
        projectId,
        floorId,
        elements,
        order,
        baseline,
        selectedId: null,
        selectedIds: [],
        dirty: new Set(),
        deletes: new Set(),
        past: [],
        future: [],
        lastTouch: null,
        canEdit,
        isContributor,
        tool: "select",
        placing: null,
        saveError: false,
      });
    }
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
  toggleAutoSave: () =>
    set((s) => {
      const on = !s.autoSave;
      if (on) scheduleAutoSave(get);
      else if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
      }
      return { autoSave: on };
    }),
  select: (id) => set({ selectedId: id, selectedIds: id == null ? [] : [id] }),

  toggleSelect: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      const selectedIds = has
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id];
      return {
        selectedIds,
        selectedId: has
          ? selectedIds[selectedIds.length - 1] ?? null
          : id,
      };
    }),

  selectAll: () =>
    set((s) => {
      const ids = s.order.filter((id) => {
        const el = s.elements[id];
        return el && s.visibleLayers.has(el.layer) && !s.lockedLayers.has(el.layer);
      });
      return { selectedIds: ids, selectedId: ids[ids.length - 1] ?? null };
    }),

  moveSelection: (ids, dx, dy) => {
    if ((dx === 0 && dy === 0) || ids.length === 0) return;
    recordHistory(get, set); // one undo step for the whole group move
    set((s) => {
      const elements = { ...s.elements };
      for (const id of ids) {
        const el = elements[id];
        if (!el) continue;
        if (el.points) {
          elements[id] = {
            ...el,
            points: el.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
          };
        } else {
          elements[id] = { ...el, x: el.x + dx, y: el.y + dy };
        }
      }
      return { elements };
    });
    refreshDirty(get, set);
    afterMutation(get);
  },

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
      selectedId: id,
      selectedIds: [id],
    }));
    refreshDirty(get, set);
    afterMutation(get);
    return id;
  },

  updateElement: (id, patch, markDirty = true) => {
    if (markDirty) recordHistory(get, set, id); // coalesce rapid edits to same element
    set((s) => {
      const existing = s.elements[id];
      if (!existing) return {};
      return { elements: { ...s.elements, [id]: { ...existing, ...patch } } };
    });
    if (markDirty) {
      refreshDirty(get, set);
      afterMutation(get);
    }
  },

  deleteElement: (id) => {
    recordHistory(get, set);
    set((s) => {
      const elements = { ...s.elements };
      delete elements[id];
      return {
        elements,
        order: s.order.filter((x) => x !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        selectedIds: s.selectedIds.filter((x) => x !== id),
      };
    });
    refreshDirty(get, set);
    afterMutation(get);
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
    refreshDirty(get, set);
    afterMutation(get);
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
    refreshDirty(get, set);
    afterMutation(get);
  },

  save: async () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    const { projectId, floorId, elements, baseline } = get();
    if (!projectId || !floorId) return;

    const { creates, updates, deletes } = computeDiff(elements, baseline);
    if (!creates.length && !updates.length && !deletes.length) return;
    set({ saving: true });

    const createBodies = creates.map((el) => {
      const { id, floor_id: _f, ...rest } = el;
      return { ...rest, client_id: id };
    });
    const updateMap: Record<number, any> = {};
    for (const el of updates) {
      const { id, floor_id: _f, ...rest } = el;
      updateMap[id] = rest;
    }

    try {
      const { data } = await api.post<{
        items: ElementModel[];
        id_map: Record<string, number>;
      }>(`/projects/${projectId}/floors/${floorId}/elements/bulk`, {
        creates: createBodies,
        updates: updateMap,
        deletes,
      });

      const idMap = data.id_map || {};
      const remap = (id: number) => idMap[id] ?? id;

      const next: Record<number, ElementModel> = {};
      const order: number[] = [];
      for (const e of data.items) {
        next[e.id] = e;
        order.push(e.id);
      }

      const s = get();
      const sel0 = s.selectedId;
      const sel = sel0 == null ? null : remap(sel0);

      set({
        elements: next,
        order,
        baseline: deepCopy(next),
        past: s.past.map((snap) => remapSnap(snap, remap)),
        future: s.future.map((snap) => remapSnap(snap, remap)),
        selectedId: sel != null && next[sel] ? sel : null,
        dirty: new Set(),
        deletes: new Set(),
        saving: false,
        saveError: false,
        lastSavedAt: Date.now(),
      });
      persistNow(get);
    } catch (e) {
      set({ saving: false, saveError: true });
      throw e;
    }
  },
}));

// ---- diff against the server baseline ----
function computeDiff(
  elements: Record<number, ElementModel>,
  baseline: Record<number, ElementModel>
) {
  const creates: ElementModel[] = [];
  const updates: ElementModel[] = [];
  const deletes: number[] = [];
  for (const key in elements) {
    const el = elements[key];
    const base = baseline[el.id];
    if (el.id < 0 || !base) creates.push(el); // brand new, or re-created (redo after delete)
    else if (stableStr(el) !== stableStr(base)) updates.push(el);
  }
  for (const key in baseline) {
    const id = Number(key);
    if (id > 0 && !elements[id]) deletes.push(id);
  }
  return { creates, updates, deletes };
}

function refreshDirty(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void
) {
  const { elements, baseline } = get();
  const { creates, updates, deletes } = computeDiff(elements, baseline);
  set({
    dirty: new Set([...creates, ...updates].map((e) => e.id)),
    deletes: new Set(deletes),
  });
}

// ---- undo/redo helpers ----
function snapshotOf(s: EditorState): HistorySnap {
  return {
    elements: { ...s.elements },
    order: [...s.order],
    selectedId: s.selectedId,
  };
}

function restoreSnap(snap: HistorySnap) {
  return {
    elements: { ...snap.elements },
    order: [...snap.order],
    selectedId: snap.selectedId,
  };
}

function remapSnap(snap: HistorySnap, remap: (id: number) => number): HistorySnap {
  const elements: Record<number, ElementModel> = {};
  for (const key in snap.elements) {
    const el = snap.elements[key];
    const nid = remap(el.id);
    elements[nid] = nid === el.id ? el : { ...el, id: nid };
  }
  return {
    elements,
    order: snap.order.map(remap),
    selectedId: snap.selectedId == null ? null : remap(snap.selectedId),
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

// ---- auto-save + persistence ----
function afterMutation(get: () => EditorState) {
  schedulePersist(get);
  scheduleAutoSave(get);
}

function scheduleAutoSave(get: () => EditorState) {
  const s = get();
  if (!s.autoSave || !s.canEdit) return;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    const st = get();
    if (st.autoSave && st.canEdit && !st.saving) st.save().catch(() => {});
  }, AUTOSAVE_MS);
}

function storageKey(projectId: number, floorId: number) {
  return `${STORAGE_PREFIX}${projectId}_${floorId}`;
}

function schedulePersist(get: () => EditorState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow(get);
  }, 600);
}

function persistNow(get: () => EditorState) {
  const s = get();
  if (!s.projectId || !s.floorId) return;
  try {
    localStorage.setItem(
      storageKey(s.projectId, s.floorId),
      JSON.stringify({
        v: 1,
        tempId,
        baseline: s.baseline,
        elements: s.elements,
        order: s.order,
        selectedId: s.selectedId,
        past: s.past.slice(-PERSIST_HISTORY),
        future: s.future.slice(0, PERSIST_HISTORY),
      })
    );
  } catch {
    /* quota / serialization issues are non-fatal */
  }
}

interface Persisted {
  baseline: Record<number, ElementModel>;
  elements: Record<number, ElementModel>;
  order: number[];
  selectedId: number | null;
  past?: HistorySnap[];
  future?: HistorySnap[];
  tempId?: number;
}

function loadPersisted(projectId: number, floorId: number): Persisted | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId, floorId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.baseline || !data.elements) return null;
    return data as Persisted;
  } catch {
    return null;
  }
}

function clearPersisted(projectId: number, floorId: number) {
  try {
    localStorage.removeItem(storageKey(projectId, floorId));
  } catch {
    /* ignore */
  }
}

// most-negative id across restored elements + history, to keep tempId unique
function minId(p: Persisted): number {
  let m = 0;
  const scan = (rec: Record<number, ElementModel>) => {
    for (const k in rec) m = Math.min(m, Number(k));
  };
  scan(p.elements);
  for (const snap of p.past ?? []) scan(snap.elements);
  for (const snap of p.future ?? []) scan(snap.elements);
  return m;
}

// ---- small utils ----
function deepCopy<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

// stable stringify (key-sorted) so element equality ignores key order
function stableStr(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStr).join(",") + "]";
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableStr(obj[k]))
      .join(",") +
    "}"
  );
}

function elementsEqual(
  a: Record<number, ElementModel>,
  b: Record<number, ElementModel>
): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!(k in b)) return false;
    if (stableStr(a[k as any]) !== stableStr(b[k as any])) return false;
  }
  return true;
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__editor = useEditor;
}
