import { useEditor } from "@/store/editor";
import { LAYERS } from "@/layers/config";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";

export function LayerPanel() {
  const { elements, order, visibleLayers, lockedLayers, toggleLayer, toggleLock, canEdit } =
    useEditor();

  const counts = order.reduce<Record<string, number>>((acc, id) => {
    const el = elements[id];
    if (el) acc[el.layer] = (acc[el.layer] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-1">
      <p className="panel-title mb-2">Layers</p>
      {LAYERS.map((layer) => {
        const Icon = layer.icon;
        const visible = visibleLayers.has(layer.type);
        const locked = lockedLayers.has(layer.type);
        return (
          <div
            key={layer.type}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
              visible ? "bg-white" : "bg-ink-100 opacity-60"
            } border border-ink-200`}
          >
            <button onClick={() => toggleLayer(layer.type)} title="Toggle visibility">
              {visible ? (
                <Eye className="h-4 w-4 text-ink-600" />
              ) : (
                <EyeOff className="h-4 w-4 text-ink-400" />
              )}
            </button>
            <span
              className="flex h-5 w-5 items-center justify-center rounded"
              style={{ backgroundColor: `${layer.color}22`, color: layer.color }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-sm">{layer.label}</span>
            {counts[layer.type] > 0 && (
              <span className="rounded bg-ink-100 px-1.5 text-xs text-ink-500">
                {counts[layer.type]}
              </span>
            )}
            {canEdit && (
              <button onClick={() => toggleLock(layer.type)} title="Lock layer">
                {locked ? (
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 text-ink-300" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
