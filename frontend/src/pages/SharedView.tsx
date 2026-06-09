import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { publicApi } from "@/lib/api";
import { useEditor } from "@/store/editor";
import { useSettings } from "@/store/settings";
import { Canvas2D } from "@/editor2d/Canvas2D";
import { Scene3D } from "@/view3d/Scene3D";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayerPanel } from "@/panels/LayerPanel";
import type { ElementModel, SharedProject } from "@/types";
import { Box, Eye, Loader2, Moon, Move3d, Sun } from "lucide-react";

// synthetic project id for the read-only store load (never hits the server)
const SHARED_PID = -999;

export function SharedView() {
  const { token } = useParams();
  const editor = useEditor();
  const { theme, toggleTheme } = useSettings();
  const [floorId, setFloorId] = useState<number>();

  const { data: project, isError, isLoading } = useQuery({
    queryKey: ["shared", token],
    queryFn: async () =>
      (await publicApi.get<SharedProject>(`/shared/${token}`)).data,
    enabled: !!token,
    retry: false,
  });

  const { data: elements } = useQuery({
    queryKey: ["shared-els", token, floorId],
    queryFn: async () =>
      (await publicApi.get<ElementModel[]>(`/shared/${token}/floors/${floorId}/elements`)).data,
    enabled: !!token && !!floorId,
  });

  // all floors' elements for the stacked 3D "Building" view
  const floorResults = useQueries({
    queries: (project?.floors ?? []).map((f) => ({
      queryKey: ["shared-els", token, f.id],
      queryFn: async () =>
        (await publicApi.get<ElementModel[]>(`/shared/${token}/floors/${f.id}/elements`)).data,
      enabled: !!token && !!f.id,
    })),
  });
  const floorEls: Record<number, ElementModel[]> = {};
  (project?.floors ?? []).forEach((f, i) => {
    if (floorResults[i]?.data) floorEls[f.id] = floorResults[i].data as ElementModel[];
  });

  useEffect(() => {
    if (project?.floors?.length && !floorId) setFloorId(project.floors[0].id);
  }, [project, floorId]);

  // feed the editor store, read-only (canEdit=false disables tools/save/autosave)
  useEffect(() => {
    if (elements && floorId) editor.load(SHARED_PID, floorId, elements, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, floorId]);

  const floor = project?.floors.find((f) => f.id === floorId);

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  if (isError || !project)
    return (
      <div className="app-bg flex h-full flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-bold">This link isn’t available</h1>
        <p className="text-sm text-ink-400">
          The share link may have been revoked or is invalid. Ask the designer for a new one.
        </p>
      </div>
    );

  return (
    <div className="app-bg flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-app surface px-4 py-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-bold leading-tight">{project.name}</h1>
            <p className="text-xs text-ink-400">
              {project.client_name && `${project.client_name} · `}
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> View-only shared link
              </span>
            </p>
          </div>
          {project.floors.length > 1 && (
            <select
              className="input ml-2 w-40 py-1"
              value={floorId}
              onChange={(e) => setFloorId(Number(e.target.value))}
            >
              {project.floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-app p-0.5">
            <button
              className={`btn px-2 py-1 ${editor.view === "2d" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
              onClick={() => editor.setView("2d")}
            >
              <Move3d className="h-4 w-4" /> 2D
            </button>
            <button
              className={`btn px-2 py-1 ${editor.view === "3d" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
              onClick={() => editor.setView("3d")}
            >
              <Box className="h-4 w-4" /> 3D
            </button>
          </div>
          <button className="btn-outline !px-2" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="scroll-thin flex w-64 flex-col gap-4 overflow-y-auto border-r border-app surface-muted p-3">
          <LayerPanel />
        </aside>

        <main className="relative min-w-0 flex-1">
          {!floor ? (
            <div className="flex h-full items-center justify-center text-ink-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : editor.view === "2d" ? (
            <Canvas2D floor={floor} units={project.units} />
          ) : (
            <ErrorBoundary label="3D view unavailable">
              <Scene3D floor={floor} floors={project.floors} floorEls={floorEls} />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
