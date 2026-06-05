import { useEditor } from "@/store/editor";
import { LAYERS, LAYER_MAP } from "@/layers/config";
import type { ElementModel, SwitchButton } from "@/types";
import { Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";

const BUTTON_TYPES = ["switch", "regulator", "socket", "dimmer", "bell", "blank"];

function NumberField({
  label,
  value,
  onChange,
  suffix = "cm",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="input"
          value={Math.round(value)}
          onChange={(e) => onChange(Number(e.target.value))}
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
  const { selectedId, elements, updateElement, deleteElement, canEdit, isContributor } =
    useEditor();
  const el = selectedId ? elements[selectedId] : null;

  if (!el)
    return (
      <p className="text-sm text-ink-400">
        Select an element to view and edit its properties.
      </p>
    );

  const update = (patch: Partial<ElementModel>) => updateElement(el.id, patch);
  const isLine = ["wall", "room", "plumbing_line"].includes(el.kind);

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

      {isLine && canEdit && (
        <div className="space-y-2">
          <p className="rounded bg-ink-50 px-2 py-1.5 text-xs text-ink-500 dark:bg-slate-800/50">
            Drag the corner handles on the canvas to reshape or extend. Corners snap
            to the grid and to nearby room/wall corners.
          </p>
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
        <div className="space-y-2 rounded-lg border border-app bg-ink-50 p-2 dark:bg-slate-800/50">
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
