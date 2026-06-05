import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
} from "@/api/hooks";
import { useAuth } from "@/store/auth";
import {
  Building2,
  LogOut,
  MapPin,
  Plus,
  Sofa,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import type { MembershipRole } from "@/types";

const roleBadge: Record<MembershipRole, string> = {
  owner: "bg-brand-100 text-brand-700",
  editor: "bg-emerald-100 text-emerald-700",
  contributor: "bg-amber-100 text-amber-700",
  viewer: "bg-ink-100 text-ink-600",
};

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    address: "",
    units: "cm",
  });

  const isDesigner = user?.role === "designer";

  const create = async () => {
    const project = await createProject.mutateAsync(form);
    setShowNew(false);
    setForm({ name: "", client_name: "", address: "", units: "cm" });
    navigate(`/projects/${project.id}`);
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-brand-600 p-1.5 text-white">
              <Sofa className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">iDesigner</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm text-ink-600">
              <UserIcon className="h-4 w-4" />
              {user?.full_name}
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
                {user?.role}
              </span>
            </span>
            <button className="btn-ghost" onClick={logout}>
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-ink-500">
              {isDesigner
                ? "Each house is a project. Open one to design its floor plan."
                : "Projects shared with you."}
            </p>
          </div>
          {isDesigner && (
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New project
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-ink-400">Loading…</p>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="card group cursor-pointer overflow-hidden transition hover:shadow-md"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-brand-50 to-ink-100">
                  <Building2 className="h-10 w-10 text-brand-500/60" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.my_role && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${roleBadge[p.my_role]}`}
                      >
                        {p.my_role}
                      </span>
                    )}
                  </div>
                  {p.client_name && (
                    <p className="mt-1 text-sm text-ink-500">
                      Client: {p.client_name}
                    </p>
                  )}
                  {p.address && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                      <MapPin className="h-3 w-3" /> {p.address}
                    </p>
                  )}
                  {p.my_role === "owner" && (
                    <button
                      className="mt-3 inline-flex items-center gap-1 text-xs text-red-500 opacity-0 transition group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${p.name}"?`))
                          deleteProject.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <Building2 className="h-10 w-10 text-ink-300" />
            <p className="text-ink-500">No projects yet.</p>
            {isDesigner && (
              <button className="btn-primary" onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" /> Create your first project
              </button>
            )}
          </div>
        )}
      </main>

      {showNew && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-bold">New project (house)</h2>
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Project name (e.g. Sharma Residence)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="input"
                placeholder="Client name"
                value={form.client_name}
                onChange={(e) =>
                  setForm({ ...form, client_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <select
                className="input"
                value={form.units}
                onChange={(e) => setForm({ ...form, units: e.target.value })}
              >
                <option value="cm">Metric (cm / m)</option>
                <option value="in">Imperial (inches / feet)</option>
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!form.name || createProject.isPending}
                onClick={create}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
