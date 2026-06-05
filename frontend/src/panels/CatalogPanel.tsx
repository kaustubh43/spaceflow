import { useMemo, useState } from "react";
import { useCatalog } from "@/api/hooks";
import { useEditor } from "@/store/editor";
import { LAYER_MAP } from "@/layers/config";
import { Search } from "lucide-react";

export function CatalogPanel() {
  const { data: catalog } = useCatalog();
  const { placing, setPlacing, canEdit } = useEditor();
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
            <p className="mb-1 text-xs font-semibold text-ink-400">{cat}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((it) => {
                const active = placing?.id === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => setPlacing(active ? null : it)}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 text-left text-xs transition ${
                      active
                        ? "border-brand-500 bg-brand-50"
                        : "border-ink-200 bg-white hover:bg-ink-100"
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
