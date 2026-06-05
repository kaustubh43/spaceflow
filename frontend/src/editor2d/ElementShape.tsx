import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { ElementModel } from "@/types";
import { layerColor } from "@/layers/config";

interface Props {
  el: ElementModel;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ElementModel>, markDirty?: boolean) => void;
}

// world units = centimetres. x,y are the CENTRE of an element's footprint.
export function ElementShape({ el, selected, draggable, onSelect, onChange }: Props) {
  const color = el.color || layerColor(el.layer);

  // ---- polyline / polygon kinds ----
  if (el.kind === "wall") {
    return (
      <Line
        name={`el-${el.id}`}
        points={el.points || []}
        stroke={selected ? "#4f46e5" : color}
        strokeWidth={11}
        lineCap="round"
        lineJoin="round"
        onMouseDown={onSelect}
        onTap={onSelect}
        hitStrokeWidth={20}
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
          stroke={selected ? "#4f46e5" : "#94a3b8"}
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
          fill="#475569"
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
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {isPoint ? (
        <Circle
          radius={Math.max(w, d) / 2 || 8}
          fill={color}
          stroke={selected ? "#4f46e5" : "#1e293b"}
          strokeWidth={selected ? 3 : 1}
          offsetX={0}
          offsetY={0}
        />
      ) : (
        <Rect
          width={w}
          height={d}
          offsetX={w / 2}
          offsetY={d / 2}
          fill={color}
          opacity={0.85}
          cornerRadius={4}
          stroke={selected ? "#4f46e5" : "#1e293b"}
          strokeWidth={selected ? 3 : 1}
        />
      )}
      {!isPoint && (
        <Text
          text={el.name}
          width={w}
          offsetX={w / 2}
          offsetY={d / 2 + 18}
          align="center"
          fontSize={12}
          fill="#1e293b"
          listening={false}
        />
      )}
    </Group>
  );
}
