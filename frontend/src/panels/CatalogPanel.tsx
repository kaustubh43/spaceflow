import { useMemo, useState } from "react";
import { useCatalog } from "@/api/hooks";
import { useEditor } from "@/store/editor";
import { LAYER_MAP } from "@/layers/config";
import { PackageCheck, Search, Tag } from "lucide-react";

export function CatalogPanel() {
  const { data: catalog } = useCatalog();
  const { placing, setPlacing, placeExisting, setPlaceExisting, canEdit } = useEditor();
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const items = (catalog || []).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.category.toLowerCase().includes(q.toLowerCase())
    );
    const by: Record<string, typeof items> = {};
    for (const it of items) (by[it.category] ??= []).push(it);
    return by;
  }, [catalog, q]);

  if (!canEdit) return null;

  return (
    <div>
      <p className="panel-title mb-2">Catalog — click then click on plan to place</p>

      {/* New vs Existing placement mode */}
      <div className="mb-2 flex rounded-lg border border-app p-0.5 text-xs">
        <button
          className={`btn flex-1 py-1 ${!placeExisting ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
          onClick={() => setPlaceExisting(false)}
          title="New items are charged in the bill of materials"
        >
          <Tag className="h-3.5 w-3.5" /> New (charged)
        </button>
        <button
          className={`btn flex-1 py-1 ${placeExisting ? "bg-teal-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
          onClick={() => setPlaceExisting(true)}
          title="Existing items the client already owns — shown on the plan but not charged"
        >
          <PackageCheck className="h-3.5 w-3.5" /> Existing
        </button>
      </div>
      {placeExisting && (
        <p className="mb-2 rounded bg-teal-50 px-2 py-1 text-xs text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          Placing existing items — won't be charged to the client.
        </p>
      )}

      <div className="relative mb-2">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-ink-400" />
        <input
          className="input pl-8"
          placeholder="Search furniture, fixtures…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="space-y-3">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-1 text-xs font-semibold text-ink-400 dark:text-slate-400">{cat}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((it) => {
                const active = placing?.id === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => setPlacing(active ? null : it)}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 text-left text-xs transition ${
                      active
                        ? "border-brand-500 bg-brand-50 text-ink-900 dark:border-brand-500 dark:bg-brand-600/30 dark:text-slate-100"
                        : "border-ink-200 bg-white text-ink-700 hover:bg-ink-100 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200 dark:hover:bg-navy-700"
                    }`}
                    title={`${LAYER_MAP[it.layer].label} · ${it.default_width_cm}×${it.default_depth_cm} cm`}
                  >
                    <span
                      className="h-6 w-6 flex-shrink-0 rounded"
                      style={{ backgroundColor: it.color }}
                    />
                    <span className="truncate">{it.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
