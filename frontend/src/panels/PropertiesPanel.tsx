import { useState } from "react";
import { useEditor } from "@/store/editor";
import { LAYERS, LAYER_MAP } from "@/layers/config";
import { DEFAULT_WALL_THICKNESS_CM } from "@/lib/units";
import type { ElementModel, SwitchButton } from "@/types";
import { Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";

const BUTTON_TYPES = ["switch", "regulator", "socket", "dimmer", "bell", "blank"];

function NumberField({
  label,
  value,
  onChange,
  suffix = "cm",
  commitOnBlur = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  commitOnBlur?: boolean; // defer onChange to blur/Enter (e.g. relative resize)
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value));
  const commit = () => {
    if (draft !== null) {
      const v = Number(draft);
      if (!Number.isNaN(v)) onChange(v);
      setDraft(null);
    }
  };
  return (
    <label className="block">
      <span className="text-xs text-ink-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="input"
          value={commitOnBlur ? shown : Math.round(value)}
          onChange={(e) =>
            commitOnBlur ? setDraft(e.target.value) : onChange(Number(e.target.value))
          }
          onBlur={commitOnBlur ? commit : undefined}
          onKeyDown={
            commitOnBlur
              ? (e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()
              : undefined
          }
        />
        <span className="text-xs text-ink-400">{suffix}</span>
      </div>
    </label>
  );
}

function SwitchboardEditor({
  el,
  update,
}: {
  el: ElementModel;
  update: (patch: Partial<ElementModel>) => void;
}) {
  const buttons: SwitchButton[] = el.properties.buttons || [];
  const setButtons = (next: SwitchButton[]) =>
    update({ properties: { ...el.properties, buttons: next } });

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-xs text-ink-500">Circuit / Board ID</span>
        <input
          className="input"
          value={el.properties.circuit || ""}
          onChange={(e) =>
            update({ properties: { ...el.properties, circuit: e.target.value } })
          }
        />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-500">
            Buttons / Modules ({buttons.length})
          </span>
          <button
            className="text-brand-600"
            onClick={() =>
              setButtons([...buttons, { label: "New", type: "switch" }])
            }
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {buttons.map((b, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className="input flex-1 py-1"
                value={b.label}
                onChange={(e) => {
                  const next = [...buttons];
                  next[i] = { ...b, label: e.target.value };
                  setButtons(next);
                }}
              />
              <select
                className="input w-24 py-1"
                value={b.type}
                onChange={(e) => {
                  const next = [...buttons];
                  next[i] = { ...b, type: e.target.value };
                  setButtons(next);
                }}
              >
                {BUTTON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                className="text-red-400"
                onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// simple key/value editors for other specialized kinds
const KIND_FIELDS: Record<string, { key: string; label: string }[]> = {
  electrical_point: [
    { key: "amperage", label: "Amperage (A)" },
    { key: "circuit", label: "Circuit" },
  ],
  plumbing_fixture: [
    { key: "supply", label: "Supply" },
    { key: "drain", label: "Drain" },
  ],
  plumbing_line: [
    { key: "diameter_mm", label: "Diameter (mm)" },
    { key: "type", label: "Type" },
  ],
  light: [
    { key: "wattage", label: "Wattage (W)" },
    { key: "type", label: "Type" },
  ],
  hvac_unit: [
    { key: "capacity_ton", label: "Capacity (ton)" },
    { key: "power_w", label: "Power (W)" },
  ],
  network_point: [{ key: "type", label: "Type" }],
};

export function PropertiesPanel() {
  const {
    selectedId,
    selectedIds,
    elements,
    updateElement,
    deleteElement,
    canEdit,
    isContributor,
  } = useEditor();
  const el = selectedId ? elements[selectedId] : null;

  // multi-selection: a compact summary + bulk delete (per-element editing is
  // for a single selection)
  if (selectedIds.length > 1) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{selectedIds.length} elements selected</p>
        <p className="text-xs text-ink-400">
          Drag any one on the canvas to move them all together. Shift-click to
          add or remove from the selection.
        </p>
        {canEdit && (
          <button
            className="btn-outline w-full text-red-600"
            onClick={() => selectedIds.forEach((id) => deleteElement(id))}
          >
            <Trash2 className="h-4 w-4" /> Delete {selectedIds.length} elements
          </button>
        )}
      </div>
    );
  }

  if (!el)
    return (
      <p className="text-sm text-ink-400">
        Select an element to view and edit its properties.
      </p>
    );

  const update = (patch: Partial<ElementModel>) => updateElement(el.id, patch);
  const isLine = ["wall", "room", "plumbing_line"].includes(el.kind);

  // bounding box of a polyline element (for resize-by-dimension)
  const lineBox = (() => {
    if (!el.points || el.points.length < 2) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < el.points.length; i += 2) {
      minX = Math.min(minX, el.points[i]);
      maxX = Math.max(maxX, el.points[i]);
      minY = Math.min(minY, el.points[i + 1]);
      maxY = Math.max(maxY, el.points[i + 1]);
    }
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  })();

  // scale the polygon to a target bounding-box size, anchored at its top-left
  const resizeLine = (newW?: number, newH?: number) => {
    if (!el.points || !lineBox) return;
    const sx = newW && lineBox.w > 0.001 ? newW / lineBox.w : 1;
    const sy = newH && lineBox.h > 0.001 ? newH / lineBox.h : 1;
    const out = el.points.map((v, i) =>
      i % 2 === 0
        ? Math.round(lineBox.minX + (v - lineBox.minX) * sx)
        : Math.round(lineBox.minY + (v - lineBox.minY) * sy)
    );
    update({ points: out });
  };

  const rotatePoints = (deg: number) => {
    if (!el.points || el.points.length < 4) return;
    const pts = el.points;
    const n = pts.length / 2;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < n; i++) {
      cx += pts[i * 2];
      cy += pts[i * 2 + 1];
    }
    cx /= n;
    cy /= n;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 2] - cx;
      const dy = pts[i * 2 + 1] - cy;
      out.push(
        Math.round(cx + dx * cos - dy * sin),
        Math.round(cy + dx * sin + dy * cos)
      );
    }
    update({ points: out });
  };
  const editableByMe =
    canEdit || (isContributor && el.client_editable);
  const readOnly = !editableByMe;
  const extraFields = KIND_FIELDS[el.kind] || [];
  const powerField = el.properties.power_w !== undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${LAYER_MAP[el.layer].color}22`,
            color: LAYER_MAP[el.layer].color,
          }}
        >
          {LAYER_MAP[el.layer].label}
        </span>
        <span className="text-xs text-ink-400">{el.kind}</span>
      </div>

      <label className="block">
        <span className="text-xs text-ink-500">Name / Label</span>
        <input
          className="input"
          disabled={readOnly}
          value={el.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>

      {!isLine && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={el.width_cm} onChange={(v) => update({ width_cm: v })} />
            <NumberField label="Depth" value={el.depth_cm} onChange={(v) => update({ depth_cm: v })} />
            <NumberField label="Height" value={el.height_cm} onChange={(v) => update({ height_cm: v })} />
            <NumberField
              label="Rotation"
              value={el.rotation_deg}
              onChange={(v) => update({ rotation_deg: v })}
              suffix="°"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={el.x} onChange={(v) => update({ x: v })} />
            <NumberField label="Y" value={el.y} onChange={(v) => update({ y: v })} />
          </div>
        </>
      )}

      {el.kind === "door" && canEdit && (
        <div className="space-y-2 rounded-lg border border-app bg-ink-50 p-2 dark:bg-navy-800/50">
          <p className="panel-title">Door</p>
          <label className="block">
            <span className="text-xs text-ink-500">
              Open angle: {Math.round(Number(el.properties.open_angle ?? 90))}°
            </span>
            <input
              type="range"
              min={0}
              max={120}
              value={Number(el.properties.open_angle ?? 90)}
              onChange={(e) =>
                update({
                  properties: { ...el.properties, open_angle: Number(e.target.value) },
                })
              }
              className="w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-500">Hinge / swing side</span>
            <select
              className="input"
              value={el.properties.swing ?? "left"}
              onChange={(e) =>
                update({ properties: { ...el.properties, swing: e.target.value } })
              }
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
      )}

      {el.kind === "window" && canEdit && (
        <NumberField
          label="Sill height (3D)"
          value={Number(el.properties.sill_cm ?? 90)}
          onChange={(v) => update({ properties: { ...el.properties, sill_cm: v } })}
        />
      )}

      {isLine && canEdit && (
        <div className="space-y-2">
          <p className="rounded bg-ink-50 px-2 py-1.5 text-xs text-ink-500 dark:bg-navy-800/50">
            Drag the corner handles on the canvas to reshape or extend. Corners snap
            to the grid and to nearby room/wall corners.
          </p>
          {lineBox && (
            <div>
              <span className="text-xs text-ink-500">Overall size (bounding box)</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <NumberField
                  label="Width"
                  value={lineBox.w}
                  commitOnBlur
                  onChange={(v) => resizeLine(Math.max(1, v), undefined)}
                />
                <NumberField
                  label="Depth"
                  value={lineBox.h}
                  commitOnBlur
                  onChange={(v) => resizeLine(undefined, Math.max(1, v))}
                />
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Scales the {el.kind} to this size (anchored at its top-left corner).
              </p>
            </div>
          )}
          <div>
            <span className="text-xs text-ink-500">Orientation</span>
            <div className="mt-1 flex gap-1">
              <button className="btn-outline flex-1 py-1" onClick={() => rotatePoints(-90)}>
                <RotateCcw className="h-4 w-4" /> 90°
              </button>
              <button className="btn-outline flex-1 py-1" onClick={() => rotatePoints(90)}>
                <RotateCw className="h-4 w-4" /> 90°
              </button>
            </div>
          </div>
          <NumberField
            label={el.kind === "room" ? "Railing height (3D, 0 = none)" : "Wall height (3D, 0 = default)"}
            value={Number(el.properties.wall_height ?? 0)}
            onChange={(v) =>
              update({ properties: { ...el.properties, wall_height: v } })
            }
          />
          {el.kind === "wall" && (
            <NumberField
              label="Wall thickness (cm)"
              value={Number(el.properties.thickness_cm ?? DEFAULT_WALL_THICKNESS_CM)}
              onChange={(v) =>
                update({
                  properties: {
                    ...el.properties,
                    thickness_cm: Math.max(2, v),
                  },
                })
              }
            />
          )}
          <p className="text-xs text-ink-400">
            Set a low height (e.g. 100) to model a balcony railing or parapet.
          </p>
        </div>
      )}

      {canEdit && (
        <label className="block">
          <span className="text-xs text-ink-500">Layer</span>
          <select
            className="input"
            value={el.layer}
            onChange={(e) => update({ layer: e.target.value as any })}
          >
            {LAYERS.map((l) => (
              <option key={l.type} value={l.type}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="text-xs text-ink-500">Colour</span>
        <input
          type="color"
          disabled={readOnly}
          className="h-9 w-full rounded border border-ink-300"
          value={el.color || LAYER_MAP[el.layer].color}
          onChange={(e) => update({ color: e.target.value })}
        />
      </label>

      {/* specialized editors */}
      {el.kind === "switchboard" && canEdit && (
        <SwitchboardEditor el={el} update={update} />
      )}

      {extraFields.length > 0 && canEdit && (
        <div className="space-y-2">
          {extraFields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs text-ink-500">{f.label}</span>
              <input
                className="input"
                value={el.properties[f.key] ?? ""}
                onChange={(e) =>
                  update({
                    properties: { ...el.properties, [f.key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
      )}

      {powerField && canEdit && (
        <label className="block">
          <span className="text-xs text-ink-500">Power draw (W)</span>
          <input
            className="input"
            value={el.properties.power_w ?? ""}
            onChange={(e) =>
              update({
                properties: { ...el.properties, power_w: Number(e.target.value) },
              })
            }
          />
        </label>
      )}

      {canEdit && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={el.client_editable}
            onChange={(e) => update({ client_editable: e.target.checked })}
          />
          Client can move / edit this item
        </label>
      )}

      {canEdit && el.catalog_item_id && (
        <div className="space-y-2 rounded-lg border border-app bg-ink-50 p-2 dark:bg-navy-800/50">
          <p className="panel-title">Costing</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={el.is_existing}
              onChange={(e) => update({ is_existing: e.target.checked })}
            />
            Existing item (don't charge the client)
          </label>
          <label className="block">
            <span className="text-xs text-ink-500">
              Price override {el.is_existing && "(not charged)"}
            </span>
            <input
              className="input"
              type="number"
              placeholder="Use catalog price"
              value={el.unit_cost_override ?? ""}
              onChange={(e) =>
                update({
                  unit_cost_override:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      )}

      {canEdit && (
        <button
          className="btn-outline w-full text-red-600"
          onClick={() => deleteElement(el.id)}
        >
          <Trash2 className="h-4 w-4" /> Delete element
        </button>
      )}
    </div>
  );
}
