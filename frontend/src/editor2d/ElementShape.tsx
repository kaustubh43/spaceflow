import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { ElementModel } from "@/types";
import { layerColor } from "@/layers/config";
import { DEFAULT_WALL_THICKNESS_CM } from "@/lib/units";

interface Props {
  el: ElementModel;
  selected: boolean;
  draggable: boolean;
  dark?: boolean;
  onSelect: (e?: any) => void;
  onChange: (patch: Partial<ElementModel>, markDirty?: boolean) => void;
  onDragMove?: (node: any) => void;
  onDragStart?: () => void;
  onDragEnd?: (node: any) => void; // when set, overrides default single-element commit
}

// On the dark canvas the structural greys disappear, so lift them to light tints.
// Vivid layer colours (electrical, plumbing, lighting…) stay as-is.
const DARK_OVERRIDE: Record<string, string> = {
  "#334155": "#cbd5e1", // architecture / walls
  "#475569": "#94a3b8", // appliances
  "#64748b": "#94a3b8", // false ceiling
};

// world units = centimetres. x,y are the CENTRE of an element's footprint.
export function ElementShape({
  el,
  selected,
  draggable,
  dark,
  onSelect,
  onChange,
  onDragMove,
  onDragStart,
  onDragEnd,
}: Props) {
  // in dark mode, lift the dark structural greys (incl. seeded wall colours) so
  // thin wall/partition lines stay legible. Vivid layer colours are untouched.
  const baseColor = el.color || layerColor(el.layer);
  const color = dark ? DARK_OVERRIDE[baseColor.toLowerCase()] ?? baseColor : baseColor;
  const labelFill = dark ? "#cbd5e1" : "#1e293b";
  const sheetFill = dark ? "#141f3a" : "#ffffff";
  const itemStroke = dark ? "#64748b" : "#1e293b";

  // ---- polyline / polygon kinds ----
  if (el.kind === "wall") {
    // real thickness in world units (cm); the Konva layer is cm-scaled so this
    // reads as true thickness at any zoom. Mitre joins for clean corners.
    const thickness = Number(el.properties?.thickness_cm ?? DEFAULT_WALL_THICKNESS_CM);
    return (
      <Line
        name={`el-${el.id}`}
        points={el.points || []}
        stroke={selected ? "#4f46e5" : color}
        strokeWidth={Math.max(2, thickness)}
        lineCap="butt"
        lineJoin="miter"
        onMouseDown={onSelect}
        onTap={onSelect}
        hitStrokeWidth={Math.max(20, thickness)}
      />
    );
  }

  if (el.kind === "room") {
    const pts = el.points || [];
    const cx = pts.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / (pts.length / 2);
    const cy = pts.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / (pts.length / 2);
    return (
      <Group onMouseDown={onSelect} onTap={onSelect}>
        <Line
          name={`el-${el.id}`}
          points={pts}
          closed
          fill={selected ? "rgba(79,70,229,0.08)" : "rgba(148,163,184,0.10)"}
          stroke={selected ? "#4f46e5" : dark ? "#64748b" : "#94a3b8"}
          strokeWidth={selected ? 3 : 1.5}
          dash={[10, 6]}
        />
        <Text
          x={cx - 80}
          y={cy - 10}
          width={160}
          align="center"
          text={el.name}
          fontSize={18}
          fontStyle="600"
          fill={dark ? "#94a3b8" : "#475569"}
          listening={false}
        />
      </Group>
    );
  }

  if (el.kind === "plumbing_line") {
    return (
      <Line
        name={`el-${el.id}`}
        points={el.points || []}
        stroke={selected ? "#4f46e5" : color}
        strokeWidth={5}
        dash={[14, 8]}
        lineCap="round"
        onMouseDown={onSelect}
        onTap={onSelect}
        hitStrokeWidth={16}
      />
    );
  }

  // ---- rectangular / point kinds (furniture, appliances, fixtures, points) ----
  const w = el.width_cm;
  const d = el.depth_cm;
  const isPoint = ["electrical_point", "light", "network_point"].includes(el.kind);
  const isDoor = el.kind === "door";
  const isWindow = el.kind === "window";
  const isLabel = el.kind === "annotation";
  // false-ceiling / flooring finishes cover whole zones — draw them as
  // translucent dashed areas so furniture beneath them stays visible.
  const isArea = el.layer === "false_ceiling" || el.layer === "flooring";

  const handleDragEnd = (e: any) => {
    onChange({ x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = (e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: node.x(),
      y: node.y(),
      rotation_deg: node.rotation(),
      width_cm: Math.max(5, Math.round(w * scaleX)),
      depth_cm: Math.max(5, Math.round(d * scaleY)),
    });
  };

  return (
    <Group
      name={`el-${el.id}`}
      x={el.x}
      y={el.y}
      rotation={el.rotation_deg}
      draggable={draggable}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragStart={() => onDragStart?.()}
      onDragMove={(e) => onDragMove?.(e.target)}
      onDragEnd={(e) => (onDragEnd ? onDragEnd(e.target) : handleDragEnd(e))}
      onTransformEnd={handleTransformEnd}
    >
      {isDoor ? (
        (() => {
          const angle = ((Number(el.properties?.open_angle ?? 90)) * Math.PI) / 180;
          const dir = el.properties?.swing === "right" ? -1 : 1;
          const hx = (dir * -w) / 2;
          const hy = d / 2;
          const steps = 18;
          const arc: number[] = [];
          for (let i = 0; i <= steps; i++) {
            const phi = (angle * i) / steps;
            arc.push(hx + dir * w * Math.cos(phi), hy - w * Math.sin(phi));
          }
          const lx = arc[arc.length - 2];
          const ly = arc[arc.length - 1];
          return (
            <>
              <Rect width={w} height={d} offsetX={w / 2} offsetY={d / 2} fill={sheetFill} />
              {/* swing path */}
              <Line
                points={arc}
                stroke={selected ? "#4f46e5" : color}
                strokeWidth={selected ? 1.5 : 1}
                dash={[6, 4]}
              />
              {/* door leaf at the open angle */}
              <Line
                points={[hx, hy, lx, ly]}
                stroke={selected ? "#4f46e5" : color}
                strokeWidth={selected ? 4 : 3}
                lineCap="round"
              />
            </>
          );
        })()
      ) : isWindow ? (
        <>
          <Rect
            width={w}
            height={d}
            offsetX={w / 2}
            offsetY={d / 2}
            fill="#e0f2fe"
            stroke={selected ? "#4f46e5" : color}
            strokeWidth={selected ? 3 : 2}
          />
          <Line
            points={[-w / 2, 0, w / 2, 0]}
            stroke={selected ? "#4f46e5" : color}
            strokeWidth={1}
          />
        </>
      ) : isPoint ? (
        <Circle
          radius={Math.max(w, d) / 2 || 8}
          fill={color}
          stroke={selected ? "#4f46e5" : "#1e293b"}
          strokeWidth={selected ? 3 : 1}
          offsetX={0}
          offsetY={0}
        />
      ) : isLabel ? (
        <Text
          text={String(el.properties?.text ?? el.name ?? "Note")}
          offsetX={w / 2}
          offsetY={d / 2}
          width={w}
          align="center"
          fontSize={16}
          fontStyle="bold"
          fill={selected ? "#4f46e5" : color}
        />
      ) : (
        <Rect
          width={w}
          height={d}
          offsetX={w / 2}
          offsetY={d / 2}
          fill={color}
          opacity={isArea ? 0.22 : el.is_existing ? 0.5 : 0.85}
          cornerRadius={4}
          stroke={selected ? "#4f46e5" : isArea ? color : el.is_existing ? "#0f766e" : itemStroke}
          strokeWidth={selected ? 3 : el.is_existing ? 2 : 1}
          dash={isArea ? [10, 6] : el.is_existing ? [8, 5] : undefined}
        />
      )}
      {!isPoint && !isDoor && !isWindow && !isLabel && (
        <Text
          text={el.name}
          width={w}
          offsetX={w / 2}
          offsetY={d / 2 + 18}
          align="center"
          fontSize={12}
          fill={labelFill}
          listening={false}
        />
      )}
    </Group>
  );
}
