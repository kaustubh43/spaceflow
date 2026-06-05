import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useCreateFloor,
  useElements,
  useFloors,
  useProject,
} from "@/api/hooks";
import { useEditor, type Tool } from "@/store/editor";
import { Canvas2D } from "@/editor2d/Canvas2D";
import { Scene3D } from "@/view3d/Scene3D";
import { LayerPanel } from "@/panels/LayerPanel";
import { CatalogPanel } from "@/panels/CatalogPanel";
import { PropertiesPanel } from "@/panels/PropertiesPanel";
import { CommentsPanel } from "@/panels/CommentsPanel";
import { BOMModal, MembersModal, SnapshotsModal } from "@/panels/Modals";
import { exportPDF, exportPNG } from "@/editor2d/stageHandle";
import { useCreateComment } from "@/api/hooks";
import {
  ArrowLeft,
  Box,
  DollarSign,
  Grid3x3,
  History,
  Image,
  Magnet,
  MessageSquare,
  MousePointer2,
  Move3d,
  PencilRuler,
  Plus,
  Ruler,
  Save,
  Square,
  Sticker,
  Users,
} from "lucide-react";

const TOOLS: { id: Tool; icon: any; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select / move" },
  { id: "wall", icon: PencilRuler, label: "Draw wall (dbl-click to finish)" },
  { id: "room", icon: Square, label: "Draw room (dbl-click to finish)" },
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

  const editor = useEditor();
  const [rightTab, setRightTab] = useState<"props" | "comments">("props");
  const [modal, setModal] = useState<null | "bom" | "members" | "snapshots">(null);

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
    <div className="flex h-full flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-ink-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn-ghost !px-2">
            <ArrowLeft className="h-4 w-4" />
          </Link>
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
            <button className="btn-ghost !px-2" onClick={addFloor} title="Add floor">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* 2D / 3D toggle */}
          <div className="flex rounded-lg border border-ink-200 p-0.5">
            <button
              className={`btn px-2 py-1 ${editor.view === "2d" ? "bg-brand-600 text-white" : "text-ink-600"}`}
              onClick={() => editor.setView("2d")}
            >
              <Move3d className="h-4 w-4" /> 2D
            </button>
            <button
              className={`btn px-2 py-1 ${editor.view === "3d" ? "bg-brand-600 text-white" : "text-ink-600"}`}
              onClick={() => editor.setView("3d")}
            >
              <Box className="h-4 w-4" /> 3D
            </button>
          </div>

          {editor.view === "2d" && (
            <>
              <button
                className={`btn-outline !px-2 ${editor.showGrid ? "bg-ink-100" : ""}`}
                onClick={editor.toggleGrid}
                title="Grid"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                className={`btn-outline !px-2 ${editor.snap ? "bg-ink-100" : ""}`}
                onClick={editor.toggleSnap}
                title="Snap to grid"
              >
                <Magnet className="h-4 w-4" />
              </button>
            </>
          )}

          <button className="btn-outline !px-2" onClick={() => setModal("bom")} title="Bill of materials">
            <DollarSign className="h-4 w-4" />
          </button>
          {canEdit && (
            <>
              <button
                className="btn-outline !px-2"
                onClick={() => setModal("snapshots")}
                title="Version history"
              >
                <History className="h-4 w-4" />
              </button>
              {myRole === "owner" && (
                <button
                  className="btn-outline !px-2"
                  onClick={() => setModal("members")}
                  title="Share"
                >
                  <Users className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          {/* export */}
          <button
            className="btn-outline !px-2"
            onClick={() => exportPNG(project.name)}
            title="Export PNG"
          >
            <Image className="h-4 w-4" />
          </button>
          <button
            className="btn-outline py-1"
            onClick={() => exportPDF(project.name, `${project.name} — ${floor.name}`)}
          >
            PDF
          </button>

          {canEdit && (
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
                : "Saved"}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left sidebar */}
        <aside className="scroll-thin flex w-64 flex-col gap-4 overflow-y-auto border-r border-ink-200 bg-ink-50 p-3">
          {editor.view === "2d" && canEdit && (
            <div>
              <p className="panel-title mb-2">Tools</p>
              <div className="grid grid-cols-5 gap-1">
                {TOOLS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      title={t.label}
                      className={`btn aspect-square !p-0 ${
                        editor.tool === t.id
                          ? "bg-brand-600 text-white"
                          : "bg-white text-ink-600 hover:bg-ink-100"
                      }`}
                      onClick={() => editor.setTool(t.id)}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
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
            <Scene3D floor={floor} />
          )}
        </main>

        {/* right sidebar */}
        <aside className="flex w-72 flex-col border-l border-ink-200 bg-white p-3">
          <div className="mb-3 flex rounded-lg border border-ink-200 p-0.5">
            <button
              className={`btn flex-1 py-1 ${rightTab === "props" ? "bg-brand-600 text-white" : "text-ink-600"}`}
              onClick={() => setRightTab("props")}
            >
              <PencilRuler className="h-4 w-4" /> Properties
            </button>
            <button
              className={`btn flex-1 py-1 ${rightTab === "comments" ? "bg-brand-600 text-white" : "text-ink-600"}`}
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

      {modal === "bom" && <BOMModal projectId={projectId} onClose={() => setModal(null)} />}
      {modal === "members" && (
        <MembersModal project={project} onClose={() => setModal(null)} />
      )}
      {modal === "snapshots" && (
        <SnapshotsModal projectId={projectId} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
