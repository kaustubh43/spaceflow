import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/store/editor";
import type { Floor } from "@/types";
import { ElementShape } from "./ElementShape";
import { stageHandle } from "./stageHandle";
import { formatLength } from "@/lib/units";

interface Props {
  floor: Floor;
  units: string;
  onCommentAt?: (x: number, y: number) => void;
}

export function Canvas2D({ floor, units, onCommentAt }: Props) {
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
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [measure, setMeasure] = useState<number[]>([]);

  // register stage for export helpers
  useEffect(() => {
    stageHandle.current = stageRef.current;
    return () => {
      stageHandle.current = null;
    };
  });

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

  const pointer = () => {
    const stage = stageRef.current!;
    const p = stage.getPointerPosition()!;
    const w = toWorld(p.x, p.y);
    return { x: snapV(w.x), y: snapV(w.y) };
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

  const finishDraft = (kind: "wall" | "room") => {
    if (draft.length < (kind === "room" ? 6 : 4)) {
      setDraft([]);
      return;
    }
    addElement({
      kind,
      layer: "architecture",
      name: kind === "room" ? "Room" : "Wall",
      points: draft,
      color: kind === "wall" ? "#334155" : "#94a3b8",
    });
    setDraft([]);
    setCursor(null);
    setTool("select");
  };

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

    if (tool === "wall" || tool === "room") {
      const { x, y } = pointer();
      setDraft((d) => [...d, x, y]);
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
    if (tool === "wall") finishDraft("wall");
    if (tool === "room") finishDraft("room");
  };

  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const step = Math.max(floor.grid_cm * 5, 50);
    const lines: JSX.Element[] = [];
    for (let x = 0; x <= floor.width_cm; x += step) {
      lines.push(
        <Line
          key={`gx${x}`}
          points={[x, 0, x, floor.height_cm]}
          stroke={x % 100 === 0 ? "#e2e8f0" : "#f1f5f9"}
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
          stroke={y % 100 === 0 ? "#e2e8f0" : "#f1f5f9"}
          strokeWidth={1 / scale}
          listening={false}
        />
      );
    }
    return lines;
  }, [showGrid, floor, scale]);

  const draftPreview = cursor ? [...draft, cursor.x, cursor.y] : draft;
  const stageDraggable = tool === "select";

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-ink-100 dark:bg-slate-800">
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
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth={2 / scale}
            shadowColor="#0f172a"
            shadowBlur={20}
            shadowOpacity={0.08}
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
                selected={selectedId === id}
                draggable={canEdit && !locked && tool === "select"}
                onSelect={() => tool === "select" && !locked && select(id)}
                onChange={(patch) => updateElement(id, patch)}
              />
            );
          })}

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
