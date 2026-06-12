import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useCreateFloor,
  useElements,
  useFloors,
  useFloorsElements,
  useProject,
} from "@/api/hooks";
import { useEditor, type Tool } from "@/store/editor";
import { Canvas2D } from "@/editor2d/Canvas2D";
import { Scene3D } from "@/view3d/Scene3D";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayerPanel } from "@/panels/LayerPanel";
import { CatalogPanel } from "@/panels/CatalogPanel";
import { PropertiesPanel } from "@/panels/PropertiesPanel";
import { CommentsPanel } from "@/panels/CommentsPanel";
import {
  AdminSettingsModal,
  AssetsModal,
  BOMModal,
  FloorSettingsModal,
  MembersModal,
  ShareModal,
  SnapshotsModal,
} from "@/panels/Modals";
import { exportPNG } from "@/editor2d/stageHandle";
import { generateProjectReport } from "@/export/report";
import { useCreateComment } from "@/api/hooks";
import { useSettings } from "@/store/settings";
import { useAuth } from "@/store/auth";
import { Tooltip } from "@/components/Tooltip";
import {
  ArrowLeft,
  Box,
  BoxSelect,
  CloudOff,
  DoorOpen,
  Grid3x3,
  History,
  Image,
  Images,
  Link2,
  Magnet,
  MessageSquare,
  Moon,
  MousePointer2,
  Move,
  Move3d,
  PencilRuler,
  Plus,
  RectangleHorizontal,
  Receipt,
  Redo2,
  RefreshCw,
  Ruler,
  Save,
  Settings,
  SlidersHorizontal,
  Square,
  Sticker,
  Sun,
  Undo2,
  Users,
} from "lucide-react";

const TOOLS: { id: Tool; icon: any; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select (drag empty space to pan the view)" },
  { id: "move", icon: Move, label: "Move — drag never pans the view; drag or arrow keys move the selected element(s)" },
  { id: "wall", icon: PencilRuler, label: "Draw wall (Enter / Finish to complete)" },
  { id: "room", icon: Square, label: "Draw room (Enter / Finish to complete)" },
  { id: "door", icon: DoorOpen, label: "Place a door" },
  { id: "window", icon: RectangleHorizontal, label: "Place a window" },
  { id: "measure", icon: Ruler, label: "Measure distance" },
  { id: "comment", icon: Sticker, label: "Pin a comment" },
];

export function ProjectEditor() {
  const { projectId: pidParam } = useParams();
  const projectId = Number(pidParam);
  const { data: project } = useProject(projectId);
  const { data: floors } = useFloors(projectId);
  const createFloor = useCreateFloor(projectId);

  const [floorId, setFloorId] = useState<number | undefined>();
  const { data: elements } = useElements(projectId, floorId);
  // all floors' elements feed the stacked "Building" 3D view
  const floorEls = useFloorsElements(projectId, (floors ?? []).map((f) => f.id));

  const editor = useEditor();
  const user = useAuth((s) => s.user);
  const { theme, toggleTheme } = useSettings();
  const [rightTab, setRightTab] = useState<"props" | "comments">("props");
  const [exporting, setExporting] = useState(false);
  const [modal, setModal] = useState<
    null | "bom" | "members" | "snapshots" | "floor" | "admin" | "share" | "assets"
  >(null);

  const createComment = useCreateComment(projectId, floorId ?? 0);

  const myRole = project?.my_role ?? "viewer";
  const canEdit = myRole === "owner" || myRole === "editor";
  const isContributor = myRole === "contributor";

  // default floor
  useEffect(() => {
    if (floors && floors.length && !floorId) setFloorId(floors[0].id);
  }, [floors, floorId]);

  // load elements into editor store
  useEffect(() => {
    if (elements && floorId) {
      editor.load(projectId, floorId, elements, canEdit, isContributor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, floorId, canEdit, isContributor]);

  // undo / redo keyboard shortcuts (ignored while typing in form fields)
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") {
        if (mod && e.key.toLowerCase() === "y") {
          e.preventDefault();
          useEditor.getState().redo();
        }
        return;
      }
      e.preventDefault();
      if (e.shiftKey) useEditor.getState().redo();
      else useEditor.getState().undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit]);

  const floor = floors?.find((f) => f.id === floorId);
  const dirtyCount = editor.dirty.size + editor.deletes.size;

  const handleSave = async () => {
    try {
      await editor.save();
    } catch {
      alert("Save failed. Check your connection / permissions.");
    }
  };

  const addFloor = async () => {
    const level = (floors?.length ?? 0);
    const f = await createFloor.mutateAsync({
      name: `Floor ${level + 1}`,
      level,
    });
    setFloorId(f.id);
  };

  if (!project || !floor)
    return (
      <div className="flex h-full items-center justify-center text-ink-400">
        Loading project…
      </div>
    );

  return (
    <div className="app-bg flex h-full flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-app surface px-4 py-2">
        <div className="flex items-center gap-3">
          <Tooltip label="Back to projects">
            <Link to="/" className="btn-ghost !px-2">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Tooltip>
          <div>
            <h1 className="text-sm font-bold leading-tight">{project.name}</h1>
            <p className="text-xs text-ink-400">
              {project.client_name && `${project.client_name} · `}
              {myRole}
            </p>
          </div>
          {/* floor switcher */}
          <select
            className="input ml-2 w-40 py-1"
            value={floorId}
            onChange={(e) => setFloorId(Number(e.target.value))}
          >
            {floors?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {canEdit && (
            <>
              <Tooltip label="Floor & architecture settings (size, grid, wall height)">
                <button className="btn-ghost !px-2" onClick={() => setModal("floor")}>
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip label="Add a floor / level">
                <button className="btn-ghost !px-2" onClick={addFloor}>
                  <Plus className="h-4 w-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {canEdit && (
            <div className="mr-1 flex gap-0.5">
              <Tooltip label="Undo (Ctrl/Cmd+Z)">
                <button
                  className="btn-outline !px-2"
                  disabled={editor.past.length === 0}
                  onClick={() => editor.undo()}
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip label="Redo (Ctrl/Cmd+Shift+Z)">
                <button
                  className="btn-outline !px-2"
                  disabled={editor.future.length === 0}
                  onClick={() => editor.redo()}
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          )}
          {/* 2D / 3D toggle */}
          <div className="flex rounded-lg border border-app p-0.5">
            <Tooltip label="2D top-view editor">
              <button
                className={`btn px-2 py-1 ${editor.view === "2d" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
                onClick={() => editor.setView("2d")}
              >
                <Move3d className="h-4 w-4" /> 2D
              </button>
            </Tooltip>
            <Tooltip label="3D walkthrough view">
              <button
                className={`btn px-2 py-1 ${editor.view === "3d" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
                onClick={() => editor.setView("3d")}
              >
                <Box className="h-4 w-4" /> 3D
              </button>
            </Tooltip>
          </div>

          {editor.view === "2d" && (
            <>
              <Tooltip label="Toggle grid">
                <button
                  className={`btn-outline !px-2 ${editor.showGrid ? "!bg-ink-100 dark:!bg-navy-700" : ""}`}
                  onClick={editor.toggleGrid}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip label="Snap to grid">
                <button
                  className={`btn-outline !px-2 ${editor.snap ? "!bg-ink-100 dark:!bg-navy-700" : ""}`}
                  onClick={editor.toggleSnap}
                >
                  <Magnet className="h-4 w-4" />
                </button>
              </Tooltip>
            </>
          )}

          <Tooltip label="Bill of materials & cost estimate">
            <button className="btn-outline !px-2" onClick={() => setModal("bom")}>
              <Receipt className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label="Reference images & mood board">
            <button className="btn-outline !px-2" onClick={() => setModal("assets")}>
              <Images className="h-4 w-4" />
            </button>
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip label="Version history (save / restore)">
                <button className="btn-outline !px-2" onClick={() => setModal("snapshots")}>
                  <History className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip label="Share a view-only link with clients (no account)">
                <button className="btn-outline !px-2" onClick={() => setModal("share")}>
                  <Link2 className="h-4 w-4" />
                </button>
              </Tooltip>
              {myRole === "owner" && (
                <Tooltip label="Manage members & roles">
                  <button className="btn-outline !px-2" onClick={() => setModal("members")}>
                    <Users className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            </>
          )}

          {/* export */}
          <Tooltip label="Export plan as PNG image">
            <button className="btn-outline !px-2" onClick={() => exportPNG(project.name)}>
              <Image className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label="Export comprehensive PDF (plan + 3D views + bill of materials)">
            <button
              className="btn-outline py-1"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await generateProjectReport(project, floor);
                } catch (e) {
                  console.error(e);
                  alert("Could not generate the PDF report.");
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? "Building…" : "PDF"}
            </button>
          </Tooltip>

          <Tooltip label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <button className="btn-outline !px-2" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </Tooltip>

          {user?.role === "designer" && (
            <Tooltip label="Application settings (admin)">
              <button className="btn-outline !px-2" onClick={() => setModal("admin")}>
                <Settings className="h-4 w-4" />
              </button>
            </Tooltip>
          )}

          {canEdit && (
            <>
              <Tooltip
                label={
                  editor.autoSave
                    ? "Auto-save is on — changes save automatically"
                    : "Auto-save is off — save manually"
                }
              >
                <button
                  className={`btn-outline !px-2 ${editor.autoSave ? "!text-emerald-600 dark:!text-emerald-400" : "!text-ink-400"}`}
                  onClick={() => editor.toggleAutoSave()}
                >
                  {editor.autoSave ? (
                    <RefreshCw className={`h-4 w-4 ${editor.saving ? "animate-spin" : ""}`} />
                  ) : (
                    <CloudOff className="h-4 w-4" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label="Save changes to the server now">
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={editor.saving || dirtyCount === 0}
                >
                  <Save className="h-4 w-4" />
                  {editor.saving
                    ? "Saving…"
                    : dirtyCount > 0
                    ? `Save (${dirtyCount})`
                    : editor.saveError
                    ? "Retry"
                    : "Saved"}
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left sidebar */}
        <aside className="scroll-thin flex w-64 flex-col gap-4 overflow-y-auto border-r border-app surface-muted p-3">
          {editor.view === "2d" && canEdit && (
            <div>
              <p className="panel-title mb-2">Tools</p>
              <div className="grid grid-cols-5 gap-1">
                {TOOLS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Tooltip key={t.id} label={t.label}>
                      <button
                        className={`btn aspect-square w-full !p-0 ${
                          editor.tool === t.id
                            ? "bg-brand-600 text-white"
                            : "surface text-ink-600 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-navy-700"
                        }`}
                        onClick={() => editor.setTool(t.id)}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
              <Tooltip label="Select everything on visible, unlocked layers (Ctrl/Cmd+A), then drag to move it all">
                <button
                  className="btn-outline mt-1 w-full py-1 text-xs"
                  onClick={() => {
                    editor.setTool("select");
                    editor.selectAll();
                  }}
                >
                  <BoxSelect className="h-4 w-4" /> Select all
                </button>
              </Tooltip>
            </div>
          )}
          <LayerPanel />
          {editor.view === "2d" && <CatalogPanel />}
        </aside>

        {/* canvas */}
        <main className="relative min-w-0 flex-1">
          {editor.view === "2d" ? (
            <Canvas2D
              floor={floor}
              units={project.units}
              onCommentAt={(x, y) =>
                createComment.mutate({ body: prompt("Comment:") || "", x, y })
              }
            />
          ) : (
            <ErrorBoundary label="3D view unavailable">
              <Scene3D floor={floor} floors={floors} floorEls={floorEls} />
            </ErrorBoundary>
          )}
        </main>

        {/* right sidebar */}
        <aside className="flex w-72 flex-col border-l border-app surface p-3">
          <div className="mb-3 flex rounded-lg border border-app p-0.5">
            <button
              className={`btn flex-1 py-1 ${rightTab === "props" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
              onClick={() => setRightTab("props")}
            >
              <PencilRuler className="h-4 w-4" /> Properties
            </button>
            <button
              className={`btn flex-1 py-1 ${rightTab === "comments" ? "bg-brand-600 text-white" : "text-ink-600 dark:text-slate-300"}`}
              onClick={() => setRightTab("comments")}
            >
              <MessageSquare className="h-4 w-4" /> Comments
            </button>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {rightTab === "props" ? (
              <PropertiesPanel />
            ) : (
              <CommentsPanel projectId={projectId} floorId={floor.id} />
            )}
          </div>
        </aside>
      </div>

      {modal === "bom" && (
        <BOMModal projectId={projectId} canEdit={canEdit} onClose={() => setModal(null)} />
      )}
      {modal === "members" && (
        <MembersModal project={project} onClose={() => setModal(null)} />
      )}
      {modal === "snapshots" && (
        <SnapshotsModal projectId={projectId} onClose={() => setModal(null)} />
      )}
      {modal === "floor" && (
        <FloorSettingsModal
          projectId={projectId}
          floor={floor}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "admin" && <AdminSettingsModal onClose={() => setModal(null)} />}
      {modal === "share" && (
        <ShareModal projectId={projectId} onClose={() => setModal(null)} />
      )}
      {modal === "assets" && (
        <AssetsModal projectId={projectId} canEdit={canEdit} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
