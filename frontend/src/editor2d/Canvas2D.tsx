import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/store/editor";
import { useSettings } from "@/store/settings";
import type { Floor } from "@/types";
import { ElementShape } from "./ElementShape";
import { stageHandle } from "./stageHandle";
import { DEFAULT_WALL_THICKNESS_CM, formatLength } from "@/lib/units";
import { Check, X } from "lucide-react";

interface Props {
  floor: Floor;
  units: string;
  onCommentAt?: (x: number, y: number) => void;
}

export function Canvas2D({ floor, units, onCommentAt }: Props) {
  const dark = useSettings((s) => s.theme === "dark");
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(0.6);
  const [pos, setPos] = useState({ x: 60, y: 60 });

  const {
    elements,
    order,
    selectedId,
    visibleLayers,
    lockedLayers,
    tool,
    placing,
    placeExisting,
    showGrid,
    snap,
    canEdit,
    select,
    addElement,
    updateElement,
    setTool,
  } = useEditor();

  // draft points while drawing a wall / room (world cm), plus live cursor point
  const [draft, setDraft] = useState<number[]>([]);
  const draftRef = useRef<number[]>([]); // always-current copy for finish handlers
  draftRef.current = draft;
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [measure, setMeasure] = useState<number[]>([]);
  // smart alignment guides shown while dragging an item
  const [guides, setGuides] = useState<{ x?: number; y?: number; wall?: number[] }>({});

  // register stage for export helpers
  useEffect(() => {
    stageHandle.current = stageRef.current;
    return () => {
      stageHandle.current = null;
    };
  });

  // clear alignment guides when a drag finishes
  useEffect(() => {
    const clear = () => setGuides({});
    window.addEventListener("mouseup", clear);
    return () => window.removeEventListener("mouseup", clear);
  }, []);

  // fit container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // initial fit-to-floor
  useEffect(() => {
    const pad = 80;
    const s = Math.min(
      (size.w - pad) / floor.width_cm,
      (size.h - pad) / floor.height_cm
    );
    if (isFinite(s) && s > 0) {
      setScale(s);
      setPos({
        x: (size.w - floor.width_cm * s) / 2,
        y: (size.h - floor.height_cm * s) / 2,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id, size.w, size.h]);

  // attach transformer to selected rect-like element
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const el = selectedId ? elements[selectedId] : null;
    const transformable =
      el && !["wall", "room", "plumbing_line"].includes(el.kind) && canEdit;
    if (transformable) {
      const node = stage.findOne(`.el-${selectedId}`);
      tr.nodes(node ? [node] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, canEdit, tool]);

  const toWorld = (px: number, py: number) => ({
    x: (px - pos.x) / scale,
    y: (py - pos.y) / scale,
  });

  const snapV = (v: number) =>
    snap ? Math.round(v / floor.grid_cm) * floor.grid_cm : v;

  // snap to a nearby wall/room corner if within ~14px, else to the grid.
  // `excludeId` skips a vertex of the element currently being dragged.
  const snapWorld = (wx: number, wy: number, excludeId?: number) => {
    const thr = 14 / scale;
    let best: [number, number] | null = null;
    let bestD = thr;
    for (const id of order) {
      const el = elements[id];
      if (!el?.points || !visibleLayers.has(el.layer)) continue;
      for (let i = 0; i < el.points.length; i += 2) {
        if (id === excludeId) continue;
        const d = Math.hypot(el.points[i] - wx, el.points[i + 1] - wy);
        if (d < bestD) {
          bestD = d;
          best = [el.points[i], el.points[i + 1]];
        }
      }
    }
    if (best) return { x: best[0], y: best[1] };
    return { x: snapV(wx), y: snapV(wy) };
  };

  const pointer = () => {
    const stage = stageRef.current!;
    const p = stage.getPointerPosition()!;
    const w = toWorld(p.x, p.y);
    return snapWorld(w.x, w.y);
  };

  // while dragging an item, snap it flush against a nearby wall, else align its
  // centre to other items / the floor centre.
  const onItemDragMove = (id: number, node: any) => {
    const thr = 8 / scale;
    const cx = node.x();
    const cy = node.y();
    const me = elements[id];

    // --- flush-snap to a nearby wall (rect/point items only) ---
    if (
      me &&
      !me.points &&
      me.kind !== "door" &&
      me.kind !== "window"
    ) {
      const a = ((me.rotation_deg || 0) * Math.PI) / 180;
      const ex = [Math.cos(a), Math.sin(a)];
      const ey = [-Math.sin(a), Math.cos(a)];
      const halfW = me.width_cm / 2;
      const halfD = me.depth_cm / 2;
      let best:
        | { d: number; fx: number; fy: number; nx: number; ny: number; offset: number; seg: number[] }
        | null = null;
      for (const oid of order) {
        const o = elements[oid];
        if (!o || o.kind !== "wall" || !o.points) continue;
        const thick = Number(o.properties?.thickness_cm ?? DEFAULT_WALL_THICKNESS_CM);
        const p = o.points;
        for (let i = 0; i + 3 < p.length; i += 2) {
          const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
          const dx = bx - ax, dy = by - ay;
          const L2 = dx * dx + dy * dy;
          if (L2 < 1) continue;
          let t = ((cx - ax) * dx + (cy - ay) * dy) / L2;
          t = Math.max(0, Math.min(1, t));
          const fx = ax + t * dx, fy = ay + t * dy;
          const d = Math.hypot(cx - fx, cy - fy);
          const L = Math.sqrt(L2);
          const nx = -dy / L, ny = dx / L; // unit normal
          const halfExtent =
            Math.abs(halfW * (ex[0] * nx + ex[1] * ny)) +
            Math.abs(halfD * (ey[0] * nx + ey[1] * ny));
          const offset = thick / 2 + halfExtent;
          if (d < offset + 22 && (!best || d < best.d)) {
            best = { d, fx, fy, nx, ny, offset, seg: [ax, ay, bx, by] };
          }
        }
      }
      if (best) {
        const side = (cx - best.fx) * best.nx + (cy - best.fy) * best.ny >= 0 ? 1 : -1;
        node.x(best.fx + best.nx * side * best.offset);
        node.y(best.fy + best.ny * side * best.offset);
        setGuides({ wall: best.seg });
        return;
      }
    }

    // --- centre-alignment guides (fallback) ---
    const targetsX = [floor.width_cm / 2];
    const targetsY = [floor.height_cm / 2];
    for (const oid of order) {
      if (oid === id) continue;
      const o = elements[oid];
      if (!o || o.points) continue;
      targetsX.push(o.x);
      targetsY.push(o.y);
    }
    let gx: number | undefined;
    let gy: number | undefined;
    let bestX = thr;
    let bestY = thr;
    for (const tx of targetsX) {
      const dx = Math.abs(tx - cx);
      if (dx < bestX) {
        bestX = dx;
        gx = tx;
      }
    }
    for (const ty of targetsY) {
      const dy = Math.abs(ty - cy);
      if (dy < bestY) {
        bestY = dy;
        gy = ty;
      }
    }
    if (gx !== undefined) node.x(gx);
    if (gy !== undefined) node.y(gy);
    setGuides({ x: gx, y: gy });
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current!;
    const old = scale;
    const ptr = stage.getPointerPosition()!;
    const mousePoint = { x: (ptr.x - pos.x) / old, y: (ptr.y - pos.y) / old };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const next = Math.min(4, Math.max(0.1, old * (direction > 0 ? 1.1 : 0.9)));
    setScale(next);
    setPos({ x: ptr.x - mousePoint.x * next, y: ptr.y - mousePoint.y * next });
  };

  // drop consecutive duplicate points (a double-click adds two at the same spot)
  const dedupe = (pts: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      if (out.length >= 2 && out[out.length - 2] === x && out[out.length - 1] === y)
        continue;
      out.push(x, y);
    }
    return out;
  };

  const finishDraft = () => {
    const kind = tool === "room" ? "room" : "wall";
    const pts = dedupe(draftRef.current);
    const minPts = kind === "room" ? 6 : 4; // room ≥3 verts, wall ≥2 verts
    if (pts.length < minPts) {
      setDraft([]);
      setCursor(null);
      return;
    }
    addElement({
      kind,
      layer: "architecture",
      name: kind === "room" ? "Room" : "Wall",
      points: pts,
      color: kind === "wall" ? "#334155" : "#94a3b8",
    });
    setDraft([]);
    setCursor(null);
    setTool("select");
  };

  const cancelDraft = () => {
    setDraft([]);
    setCursor(null);
  };

  // finish with Enter, cancel with Escape while drawing
  useEffect(() => {
    if (tool !== "wall" && tool !== "room") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishDraft();
      } else if (e.key === "Escape") {
        cancelDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedEmpty = e.target === e.target.getStage();

    if (tool === "place" && placing) {
      const { x, y } = pointer();
      addElement({
        kind: placing.kind,
        layer: placing.layer,
        name: placing.name,
        x,
        y,
        width_cm: placing.default_width_cm,
        depth_cm: placing.default_depth_cm,
        height_cm: placing.default_height_cm,
        color: placing.color,
        catalog_item_id: placing.id,
        is_existing: placeExisting,
        properties: { ...placing.default_properties },
      });
      return;
    }

    if (tool === "door" || tool === "window") {
      const { x, y } = pointer();
      if (tool === "door") {
        addElement({
          kind: "door", layer: "architecture", name: "Door",
          x, y, width_cm: 90, depth_cm: 12, height_cm: 210,
          color: "#b45309", properties: { swing: "left", open_angle: 90 },
        });
      } else {
        addElement({
          kind: "window", layer: "architecture", name: "Window",
          x, y, width_cm: 120, depth_cm: 12, height_cm: 120,
          color: "#7dd3fc", properties: { sill_cm: 90 },
        });
      }
      setTool("select");
      return;
    }

    if (tool === "wall" || tool === "room") {
      const { x, y } = pointer();
      const d = draftRef.current;
      // clicking on/near the first point closes the shape
      if (d.length >= (tool === "room" ? 6 : 4)) {
        const dist = Math.hypot(d[0] - x, d[1] - y);
        if (dist <= floor.grid_cm * 1.5) {
          finishDraft();
          return;
        }
      }
      setDraft((prev) => [...prev, x, y]);
      return;
    }

    if (tool === "measure") {
      const { x, y } = pointer();
      setMeasure((m) => (m.length >= 4 ? [x, y] : [...m, x, y]));
      return;
    }

    if (tool === "comment" && clickedEmpty && onCommentAt) {
      const { x, y } = pointer();
      onCommentAt(x, y);
      return;
    }

    if (clickedEmpty) select(null);
  };

  const onStageMouseMove = () => {
    if (tool === "wall" || tool === "room") {
      const { x, y } = pointer();
      setCursor({ x, y });
    }
  };

  const onStageDblClick = () => {
    if (tool === "wall" || tool === "room") finishDraft();
  };

  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const step = Math.max(floor.grid_cm * 5, 50);
    const major = dark ? "#2e3e69" : "#e2e8f0";
    const minor = dark ? "#1f2c4d" : "#f1f5f9";
    const lines: JSX.Element[] = [];
    for (let x = 0; x <= floor.width_cm; x += step) {
      lines.push(
        <Line
          key={`gx${x}`}
          points={[x, 0, x, floor.height_cm]}
          stroke={x % 100 === 0 ? major : minor}
          strokeWidth={1 / scale}
          listening={false}
        />
      );
    }
    for (let y = 0; y <= floor.height_cm; y += step) {
      lines.push(
        <Line
          key={`gy${y}`}
          points={[0, y, floor.width_cm, y]}
          stroke={y % 100 === 0 ? major : minor}
          strokeWidth={1 / scale}
          listening={false}
        />
      );
    }
    return lines;
  }, [showGrid, floor, scale, dark]);

  const draftPreview = cursor ? [...draft, cursor.x, cursor.y] : draft;
  const stageDraggable = tool === "select";

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-ink-100 dark:bg-navy-950">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable={stageDraggable}
        onWheel={onWheel}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onDblClick={onStageDblClick}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage())
            setPos({ x: e.target.x(), y: e.target.y() });
        }}
      >
        <Layer>
          {/* floor sheet */}
          <Rect
            width={floor.width_cm}
            height={floor.height_cm}
            fill={dark ? "#141f3a" : "#ffffff"}
            stroke={dark ? "#2e3e69" : "#cbd5e1"}
            strokeWidth={2 / scale}
            shadowColor={dark ? "#000000" : "#0f172a"}
            shadowBlur={20}
            shadowOpacity={dark ? 0.5 : 0.08}
            listening={false}
          />
          {gridLines}

          {/* elements in z-order, filtered by visible layers */}
          {order.map((id) => {
            const el = elements[id];
            if (!el || !visibleLayers.has(el.layer)) return null;
            const locked = lockedLayers.has(el.layer);
            return (
              <ElementShape
                key={id}
                el={el}
                dark={dark}
                selected={selectedId === id}
                draggable={canEdit && !locked && tool === "select"}
                onSelect={() => tool === "select" && !locked && select(id)}
                onChange={(patch) => updateElement(id, patch)}
                onDragMove={(node) => onItemDragMove(id, node)}
              />
            );
          })}

          {/* vertex handles for the selected wall / room / pipe — drag a corner to reshape */}
          {(() => {
            const el = selectedId ? elements[selectedId] : null;
            if (
              !el ||
              !el.points ||
              !canEdit ||
              lockedLayers.has(el.layer) ||
              tool !== "select"
            )
              return null;
            const pts = el.points;
            return Array.from({ length: pts.length / 2 }).map((_, i) => (
              <Circle
                key={`vh-${el.id}-${i}`}
                x={pts[i * 2]}
                y={pts[i * 2 + 1]}
                radius={7 / scale}
                fill="#ffffff"
                stroke="#4f46e5"
                strokeWidth={2 / scale}
                draggable
                onDragMove={(e) => {
                  const snapped = snapWorld(e.target.x(), e.target.y(), el.id);
                  e.target.position(snapped);
                  const next = [...pts];
                  next[i * 2] = snapped.x;
                  next[i * 2 + 1] = snapped.y;
                  updateElement(el.id, { points: next });
                }}
                onMouseEnter={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = "move";
                }}
                onMouseLeave={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = "default";
                }}
              />
            ));
          })()}

          {/* draft polyline for wall/room */}
          {draft.length > 0 && (
            <>
              <Line
                points={draftPreview}
                stroke="#4f46e5"
                strokeWidth={3 / scale}
                dash={[8 / scale, 6 / scale]}
                closed={tool === "room"}
                fill={tool === "room" ? "rgba(79,70,229,0.06)" : undefined}
              />
              {Array.from({ length: draft.length / 2 }).map((_, i) => (
                <Circle
                  key={i}
                  x={draft[i * 2]}
                  y={draft[i * 2 + 1]}
                  radius={5 / scale}
                  fill="#4f46e5"
                />
              ))}
            </>
          )}

          {/* smart alignment guides */}
          {guides.wall && (
            <Line
              points={guides.wall}
              stroke="#ec4899"
              strokeWidth={4 / scale}
              dash={[10 / scale, 6 / scale]}
              lineCap="round"
              listening={false}
            />
          )}
          {guides.x !== undefined && (
            <Line
              points={[guides.x, -2000, guides.x, floor.height_cm + 2000]}
              stroke="#ec4899"
              strokeWidth={1 / scale}
              dash={[6 / scale, 4 / scale]}
              listening={false}
            />
          )}
          {guides.y !== undefined && (
            <Line
              points={[-2000, guides.y, floor.width_cm + 2000, guides.y]}
              stroke="#ec4899"
              strokeWidth={1 / scale}
              dash={[6 / scale, 4 / scale]}
              listening={false}
            />
          )}

          {/* measure tool */}
          {measure.length === 4 && (
            <>
              <Line points={measure} stroke="#ef4444" strokeWidth={2 / scale} />
              <Text
                x={(measure[0] + measure[2]) / 2}
                y={(measure[1] + measure[3]) / 2 - 20 / scale}
                text={formatLength(
                  Math.hypot(measure[2] - measure[0], measure[3] - measure[1]),
                  units
                )}
                fontSize={16 / scale}
                fill="#ef4444"
                fontStyle="bold"
              />
            </>
          )}

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio={false}
            anchorSize={8}
            borderStroke="#4f46e5"
            anchorStroke="#4f46e5"
          />
        </Layer>
      </Stage>

      {/* dimensions readout for selected element */}
      <SelectionReadout units={units} />

      {/* drawing toolbar (wall / room) */}
      {(tool === "wall" || tool === "room") && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-ink-900/90 px-3 py-2 text-sm text-white shadow-lg backdrop-blur dark:bg-navy-700/90">
          <span className="text-xs">
            {draft.length === 0
              ? `Click to start the ${tool}. `
              : `${draft.length / 2} point${draft.length / 2 > 1 ? "s" : ""} · click to add. `}
            Double-click, Enter, or click the first point to finish.
          </span>
          <button
            className="btn bg-emerald-500 px-2 py-1 text-white hover:bg-emerald-600 disabled:opacity-40"
            disabled={draft.length < (tool === "room" ? 6 : 4)}
            onClick={finishDraft}
          >
            <Check className="h-4 w-4" /> Finish
          </button>
          <button
            className="btn bg-white/15 px-2 py-1 text-white hover:bg-white/25"
            onClick={cancelDraft}
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>
      )}

      {/* zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          className="btn-outline h-8 w-8 !p-0"
          onClick={() => setScale((s) => Math.min(4, s * 1.2))}
        >
          +
        </button>
        <div className="rounded bg-white px-1 py-0.5 text-center text-xs text-ink-500 shadow">
          {Math.round(scale * 100)}%
        </div>
        <button
          className="btn-outline h-8 w-8 !p-0"
          onClick={() => setScale((s) => Math.max(0.1, s / 1.2))}
        >
          −
        </button>
      </div>
    </div>
  );
}

function SelectionReadout({ units }: { units: string }) {
  const { selectedId, elements } = useEditor();
  const el = selectedId ? elements[selectedId] : null;
  if (!el || ["wall", "room", "plumbing_line"].includes(el.kind)) return null;
  return (
    <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs shadow backdrop-blur">
      <span className="font-medium">{el.name || el.kind}</span>{" "}
      <span className="text-ink-500">
        {formatLength(el.width_cm, units)} × {formatLength(el.depth_cm, units)} ·{" "}
        {Math.round(el.rotation_deg)}°
      </span>
    </div>
  );
}
