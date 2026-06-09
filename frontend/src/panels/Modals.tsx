import { useState } from "react";
import {
  useAddMember,
  useBOM,
  useCatalog,
  useCostItems,
  useCreateCostItem,
  useCreateShareLink,
  useCreateSnapshot,
  useDeleteCostItem,
  useItemOverride,
  useRemoveMember,
  useRestoreSnapshot,
  useRevokeShareLink,
  useShareLinks,
  useSnapshots,
  useUpdateCostItem,
  useUpdateFloor,
} from "@/api/hooks";
import type { Floor, Project } from "@/types";
import { LAYER_MAP } from "@/layers/config";
import { useMoney, useSettings } from "@/store/settings";
import {
  Check,
  Copy,
  History,
  Link2,
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
  const { data: catalog } = useCatalog();
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
  const [catalogPick, setCatalogPick] = useState("");

  const lines = data?.lines || [];
  const charged = lines.filter((l) => !l.is_existing);
  const existingLines = lines.filter((l) => l.is_existing);

  // group charged lines (placed items + manual costs) by category
  const groups: Record<string, typeof charged> = {};
  for (const l of charged) (groups[l.category] ??= []).push(l);
  const categories = Object.keys(groups).sort();

  const addFromCatalog = async () => {
    const item = catalog?.find((c) => String(c.id) === catalogPick);
    if (!item) return;
    await createCost.mutateAsync({
      label: item.name,
      category: item.category,
      quantity: 1,
      unit: "item",
      unit_cost: item.unit_cost,
    });
    setCatalogPick("");
  };

  return (
    <Shell title="Bill of Materials & Estimate" onClose={onClose} wide>
      <p className="mb-3 text-sm text-ink-500">
        Items placed on the plan are costed automatically. You can also add items
        and work below without drawing them. Everything is grouped by category.
      </p>

      {categories.length === 0 && (
        <p className="text-ink-400">Nothing costed yet — add items below.</p>
      )}

      {categories.map((cat) => {
        const rows = groups[cat];
        const subtotal = rows.reduce((a, r) => a + r.total_cost, 0);
        return (
          <div key={cat} className="mb-5">
            <div className="mb-1 flex items-center justify-between border-b border-app pb-1">
              <h3 className="text-sm font-semibold">{cat}</h3>
              <span className="text-sm font-medium text-ink-500">
                {money(subtotal)}
              </span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {rows.map((l) => (
                  <tr
                    key={`${l.source}-${l.ref_id}`}
                    className="border-b border-app/50"
                  >
                    <td className="py-1.5">
                      {l.source === "manual" && canEdit ? (
                        <input
                          className="input py-1"
                          defaultValue={l.name}
                          onBlur={(e) =>
                            updateCost.mutate({
                              id: l.ref_id!,
                              body: { label: e.target.value },
                            })
                          }
                        />
                      ) : (
                        <span>
                          {l.name}
                          {l.source === "item" && (
                            <span className="ml-1 text-xs text-ink-400">(on plan)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="w-16 text-right">
                      {l.source === "manual" && canEdit ? (
                        <input
                          type="number"
                          className="input w-14 py-1 text-right"
                          defaultValue={l.quantity}
                          onBlur={(e) =>
                            updateCost.mutate({
                              id: l.ref_id!,
                              body: { quantity: Number(e.target.value) },
                            })
                          }
                        />
                      ) : (
                        `${l.quantity}×`
                      )}
                    </td>
                    <td className="w-28 text-right">
                      {canEdit ? (
                        <input
                          type="number"
                          className="input w-24 py-1 text-right"
                          defaultValue={Math.round(l.unit_cost)}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (l.source === "manual")
                              updateCost.mutate({ id: l.ref_id!, body: { unit_cost: v } });
                            else
                              override.mutate({ catalog_item_id: l.ref_id!, unit_cost: v });
                          }}
                        />
                      ) : (
                        money(l.unit_cost)
                      )}
                    </td>
                    <td className="w-28 text-right font-medium">{money(l.total_cost)}</td>
                    {canEdit && (
                      <td className="w-8 text-right">
                        {l.source === "manual" ? (
                          <button
                            className="text-red-400"
                            title="Remove"
                            onClick={() => deleteCost.mutate(l.ref_id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            className="text-teal-500 hover:text-teal-600"
                            title="Mark as existing (don't charge)"
                            onClick={() =>
                              override.mutate({
                                catalog_item_id: l.ref_id!,
                                is_existing: true,
                              })
                            }
                          >
                            <PackageCheck className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Add rows */}
      {canEdit && (
        <div className="space-y-2 rounded-lg border border-app bg-ink-50 p-3 dark:bg-slate-800/50">
          <p className="panel-title">Add to estimate (no drawing needed)</p>
          {/* add from catalog */}
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="text-xs text-ink-500">From catalog</span>
              <select
                className="input"
                value={catalogPick}
                onChange={(e) => setCatalogPick(e.target.value)}
              >
                <option value="">Select an item…</option>
                {catalog?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category} — {c.name} ({money(c.unit_cost)})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn-primary"
              disabled={!catalogPick}
              onClick={addFromCatalog}
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>
          {/* custom line */}
          <div className="flex flex-wrap items-end gap-2">
            <input
              className="input flex-1"
              placeholder="Custom line (e.g. Civil work — wall masonry)"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
            <select
              className="input w-36"
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

export function ShareModal({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const { data: links } = useShareLinks(projectId);
  const create = useCreateShareLink(projectId);
  const revoke = useRevokeShareLink(projectId);
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const urlFor = (token: string) => `${window.location.origin}/shared/${token}`;
  const copy = async (id: number, token: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(token));
    } catch {
      /* clipboard may be blocked; the URL is still visible to select */
    }
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  return (
    <Shell title="Share with clients" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-500">
        Create a <strong>view-only</strong> link anyone can open — no account needed. They can browse the
        2D plan and 3D walkthrough but can't edit, and costs are never shown.
      </p>
      <div className="mb-4 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Label (optional, e.g. “For the Sharmas”)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          className="btn-primary whitespace-nowrap"
          disabled={create.isPending}
          onClick={() => {
            create.mutate(label);
            setLabel("");
          }}
        >
          <Link2 className="h-4 w-4" /> Create link
        </button>
      </div>
      <div className="space-y-2">
        {(links ?? []).length === 0 && (
          <p className="text-sm text-ink-400">No links yet.</p>
        )}
        {(links ?? []).map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-lg border border-app px-3 py-2">
            <div className="min-w-0 flex-1">
              {l.label && <p className="truncate text-sm font-medium">{l.label}</p>}
              <p className="truncate text-xs text-ink-400">{urlFor(l.token)}</p>
            </div>
            <button className="btn-outline !px-2" onClick={() => copy(l.id, l.token)} title="Copy link">
              {copied === l.id ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              className="btn-outline !px-2 !text-rose-600"
              onClick={() => revoke.mutate(l.id)}
              title="Revoke link"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}
