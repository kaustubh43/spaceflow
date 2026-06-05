import { useState } from "react";
import {
  useAddMember,
  useBOM,
  useCostItems,
  useCreateCostItem,
  useCreateSnapshot,
  useDeleteCostItem,
  useItemOverride,
  useRemoveMember,
  useRestoreSnapshot,
  useSnapshots,
  useUpdateCostItem,
  useUpdateFloor,
} from "@/api/hooks";
import type { Floor, Project } from "@/types";
import { LAYER_MAP } from "@/layers/config";
import { useMoney, useSettings } from "@/store/settings";
import {
  History,
  PackageCheck,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

function Shell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`card max-h-[85vh] w-full overflow-hidden ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b border-app px-5 py-3">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scroll-thin max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const COST_CATEGORIES = [
  "Civil Work",
  "Labour",
  "Plumbing Work",
  "Electrical Work",
  "Painting",
  "Carpentry",
  "False Ceiling",
  "Transport",
  "Design Fee",
  "Custom",
];

export function BOMModal({
  projectId,
  canEdit,
  onClose,
}: {
  projectId: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { data } = useBOM(projectId);
  const { data: costItems } = useCostItems(projectId);
  const money = useMoney();
  const createCost = useCreateCostItem(projectId);
  const updateCost = useUpdateCostItem(projectId);
  const deleteCost = useDeleteCostItem(projectId);
  const override = useItemOverride(projectId);
  const [draft, setDraft] = useState({
    label: "",
    category: "Civil Work",
    quantity: 1,
    unit: "item",
    unit_cost: 0,
  });

  const itemLines = (data?.lines || []).filter((l) => l.source === "item" && !l.is_existing);
  const existingLines = (data?.lines || []).filter((l) => l.source === "item" && l.is_existing);

  return (
    <Shell title="Bill of Materials & Estimate" onClose={onClose} wide>
      {/* Placed items (charged) */}
      <h3 className="panel-title mb-2">Items on the plan (charged)</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-app text-left text-ink-500">
            <th className="py-2">Item</th>
            <th>Layer</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit cost</th>
            <th className="text-right">Total</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {itemLines.map((l) => (
            <tr key={`i${l.ref_id}`} className="border-b border-app/60">
              <td className="py-1.5">{l.name}</td>
              <td>
                {l.layer && (
                  <span style={{ color: LAYER_MAP[l.layer].color }}>
                    {LAYER_MAP[l.layer].label}
                  </span>
                )}
              </td>
              <td className="text-right">{l.quantity}</td>
              <td className="text-right">
                {canEdit ? (
                  <input
                    type="number"
                    className="input w-24 py-1 text-right"
                    defaultValue={Math.round(l.unit_cost)}
                    onBlur={(e) =>
                      override.mutate({
                        catalog_item_id: l.ref_id!,
                        unit_cost: Number(e.target.value),
                      })
                    }
                  />
                ) : (
                  money(l.unit_cost)
                )}
              </td>
              <td className="text-right font-medium">{money(l.total_cost)}</td>
              {canEdit && (
                <td className="text-right">
                  <button
                    title="Move to existing (don't charge)"
                    className="text-teal-500 hover:text-teal-600"
                    onClick={() =>
                      override.mutate({ catalog_item_id: l.ref_id!, is_existing: true })
                    }
                  >
                    <PackageCheck className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {itemLines.length === 0 && (
            <tr>
              <td colSpan={6} className="py-2 text-ink-400">
                No charged items placed yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Manual cost lines */}
      <h3 className="panel-title mb-2 mt-6">Work & other costs</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-app text-left text-ink-500">
            <th className="py-2">Description</th>
            <th>Category</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit cost</th>
            <th className="text-right">Total</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {(costItems || []).map((ci) => (
            <tr key={ci.id} className="border-b border-app/60">
              <td className="py-1.5">
                {canEdit ? (
                  <input
                    className="input py-1"
                    defaultValue={ci.label}
                    onBlur={(e) =>
                      updateCost.mutate({ id: ci.id, body: { label: e.target.value } })
                    }
                  />
                ) : (
                  ci.label
                )}
              </td>
              <td>
                {canEdit ? (
                  <select
                    className="input w-32 py-1"
                    defaultValue={ci.category}
                    onChange={(e) =>
                      updateCost.mutate({ id: ci.id, body: { category: e.target.value } })
                    }
                  >
                    {COST_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  ci.category
                )}
              </td>
              <td className="text-right">
                {canEdit ? (
                  <input
                    type="number"
                    className="input w-16 py-1 text-right"
                    defaultValue={ci.quantity}
                    onBlur={(e) =>
                      updateCost.mutate({ id: ci.id, body: { quantity: Number(e.target.value) } })
                    }
                  />
                ) : (
                  ci.quantity
                )}
              </td>
              <td className="text-right">
                {canEdit ? (
                  <input
                    type="number"
                    className="input w-24 py-1 text-right"
                    defaultValue={ci.unit_cost}
                    onBlur={(e) =>
                      updateCost.mutate({ id: ci.id, body: { unit_cost: Number(e.target.value) } })
                    }
                  />
                ) : (
                  money(ci.unit_cost)
                )}
              </td>
              <td className="text-right font-medium">{money(ci.quantity * ci.unit_cost)}</td>
              {canEdit && (
                <td className="text-right">
                  <button className="text-red-400" onClick={() => deleteCost.mutate(ci.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {canEdit && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-app bg-ink-50 p-2 dark:bg-slate-800/50">
          <input
            className="input flex-1"
            placeholder="Add a cost (e.g. Civil work — wall demolition)"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <select
            className="input w-32"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            {COST_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            className="input w-16"
            title="Quantity"
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })}
          />
          <input
            type="number"
            className="input w-24"
            title="Unit cost"
            value={draft.unit_cost}
            onChange={(e) => setDraft({ ...draft, unit_cost: Number(e.target.value) })}
          />
          <button
            className="btn-primary"
            disabled={!draft.label}
            onClick={async () => {
              await createCost.mutateAsync(draft);
              setDraft({ ...draft, label: "", quantity: 1, unit_cost: 0 });
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      )}

      {/* Existing (not charged) */}
      {existingLines.length > 0 && (
        <>
          <h3 className="panel-title mb-2 mt-6 flex items-center gap-1">
            <PackageCheck className="h-3.5 w-3.5" /> Existing items (not charged)
          </h3>
          <table className="w-full text-sm opacity-70">
            <tbody>
              {existingLines.map((l) => (
                <tr key={`e${l.ref_id}`} className="border-b border-app/60">
                  <td className="py-1.5">{l.name}</td>
                  <td className="text-right">{l.quantity}×</td>
                  <td className="text-right">{money(l.unit_cost)}</td>
                  <td className="text-right text-teal-600">not charged</td>
                  {canEdit && (
                    <td className="text-right">
                      <button
                        title="Charge the client for this item"
                        className="text-brand-500"
                        onClick={() =>
                          override.mutate({ catalog_item_id: l.ref_id!, is_existing: false })
                        }
                      >
                        + charge
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Totals */}
      <div className="mt-6 space-y-1 border-t border-app pt-3 text-right text-sm">
        {data && data.existing_value > 0 && (
          <p className="text-ink-400">
            Existing items value (not charged): {money(data.existing_value)}
          </p>
        )}
        <p className="text-lg font-bold">
          Grand total:{" "}
          <span className="text-brand-600">{money(data?.grand_total ?? 0)}</span>
        </p>
      </div>
    </Shell>
  );
}

export function FloorSettingsModal({
  projectId,
  floor,
  onClose,
}: {
  projectId: number;
  floor: Floor;
  onClose: () => void;
}) {
  const updateFloor = useUpdateFloor(projectId);
  const [form, setForm] = useState({
    name: floor.name,
    width_cm: floor.width_cm,
    height_cm: floor.height_cm,
    grid_cm: floor.grid_cm,
    wall_height_cm: floor.wall_height_cm,
  });

  const save = async () => {
    await updateFloor.mutateAsync({ id: floor.id, body: form });
    onClose();
  };

  const field = (label: string, key: keyof typeof form, suffix = "cm") => (
    <label className="block">
      <span className="text-xs text-ink-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="input"
          value={form[key] as number}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
        />
        <span className="text-xs text-ink-400">{suffix}</span>
      </div>
    </label>
  );

  return (
    <Shell title="Floor & architecture settings" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-ink-500">Floor name</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {field("Floor width", "width_cm")}
          {field("Floor depth", "height_cm")}
          {field("Grid spacing", "grid_cm")}
          {field("Wall height (for 3D)", "wall_height_cm")}
        </div>
        <p className="text-xs text-ink-400">
          Width/depth set the drawing sheet size. Grid spacing controls snapping. Wall
          height drives the 3D extrusion.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save}>
          Save changes
        </button>
      </div>
    </Shell>
  );
}

export function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, theme, update, setTheme } = useSettings();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const CURRENCIES = [
    { code: "INR", symbol: "₹", locale: "en-IN", label: "Indian Rupee (₹)" },
    { code: "USD", symbol: "$", locale: "en-US", label: "US Dollar ($)" },
    { code: "EUR", symbol: "€", locale: "de-DE", label: "Euro (€)" },
    { code: "GBP", symbol: "£", locale: "en-GB", label: "British Pound (£)" },
    { code: "AED", symbol: "د.إ", locale: "ar-AE", label: "UAE Dirham (د.إ)" },
  ];

  const save = async () => {
    setSaving(true);
    try {
      await update(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="Application settings (admin)" onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-ink-500">Application name</span>
          <input
            className="input"
            value={form.app_name}
            onChange={(e) => setForm({ ...form, app_name: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-xs text-ink-500">Currency</span>
          <select
            className="input"
            value={form.currency_code}
            onChange={(e) => {
              const c = CURRENCIES.find((x) => x.code === e.target.value)!;
              setForm({
                ...form,
                currency_code: c.code,
                currency_symbol: c.symbol,
                currency_locale: c.locale,
              });
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-ink-500">Default units for new projects</span>
          <select
            className="input"
            value={form.default_units}
            onChange={(e) => setForm({ ...form, default_units: e.target.value })}
          >
            <option value="cm">Metric (cm / m)</option>
            <option value="in">Imperial (inches / feet)</option>
          </select>
        </label>

        <div>
          <span className="text-xs text-ink-500">Appearance</span>
          <div className="mt-1 flex rounded-lg border border-app p-0.5">
            <button
              className={`btn flex-1 py-1.5 ${theme === "light" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              className={`btn flex-1 py-1.5 ${theme === "dark" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Theme is saved on this device. Other settings apply application-wide.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </Shell>
  );
}

export function MembersModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const add = useAddMember(project.id);
  const remove = useRemoveMember(project.id);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      await add.mutateAsync({ email, role });
      setEmail("");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not add member");
    }
  };

  return (
    <Shell title="Share & collaborators" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-500">
        Invite clients or teammates by email (they must have registered).
        <br />
        <b>viewer</b> = look + comment · <b>contributor</b> = move client-editable
        items · <b>editor</b> = full edit.
      </p>
      <div className="mb-2 flex gap-1">
        <input
          className="input"
          placeholder="person@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="input w-32" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="viewer">viewer</option>
          <option value="contributor">contributor</option>
          <option value="editor">editor</option>
        </select>
        <button className="btn-primary !px-2" onClick={submit}>
          <UserPlus className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-1">
        {project.memberships?.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border border-app px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{m.user.full_name}</span>{" "}
              <span className="text-ink-400">{m.user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-ink-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {m.role}
              </span>
              {m.role !== "owner" && (
                <button className="text-red-400" onClick={() => remove.mutate(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function SnapshotsModal({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const { data } = useSnapshots(projectId);
  const create = useCreateSnapshot(projectId);
  const restore = useRestoreSnapshot(projectId);
  const [label, setLabel] = useState("");

  return (
    <Shell title="Version history" onClose={onClose}>
      <div className="mb-3 flex gap-1">
        <input
          className="input"
          placeholder="Snapshot label (e.g. 'Client review v1')"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          className="btn-primary"
          onClick={async () => {
            if (label.trim()) {
              await create.mutateAsync(label);
              setLabel("");
            }
          }}
        >
          Save snapshot
        </button>
      </div>
      <div className="space-y-1">
        {data?.length ? (
          data.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-app px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <History className="h-4 w-4 text-ink-400" /> {s.label}
              </span>
              <button
                className="btn-outline py-1"
                onClick={() => {
                  if (confirm("Restore this version? Current layout will be replaced."))
                    restore.mutate(s.id);
                }}
              >
                Restore
              </button>
            </div>
          ))
        ) : (
          <p className="text-ink-400">No snapshots yet.</p>
        )}
      </div>
    </Shell>
  );
}
