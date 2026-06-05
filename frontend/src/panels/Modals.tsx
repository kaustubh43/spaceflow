import { useState } from "react";
import {
  useAddMember,
  useBOM,
  useCreateSnapshot,
  useRemoveMember,
  useRestoreSnapshot,
  useSnapshots,
} from "@/api/hooks";
import type { Project } from "@/types";
import { LAYER_MAP } from "@/layers/config";
import { formatMoney } from "@/lib/units";
import { History, Trash2, UserPlus, X } from "lucide-react";

function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[80vh] w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scroll-thin max-h-[65vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function BOMModal({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const { data } = useBOM(projectId);
  return (
    <Shell title="Bill of Materials & Estimate" onClose={onClose}>
      {data && data.lines.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-ink-500">
              <th className="py-2">Item</th>
              <th>Layer</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i} className="border-b border-ink-100">
                <td className="py-1.5">{l.name}</td>
                <td>
                  <span style={{ color: LAYER_MAP[l.layer].color }}>
                    {LAYER_MAP[l.layer].label}
                  </span>
                </td>
                <td className="text-right">{l.quantity}</td>
                <td className="text-right">{formatMoney(l.unit_cost)}</td>
                <td className="text-right font-medium">{formatMoney(l.total_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right font-semibold">
                Grand total
              </td>
              <td className="pt-3 text-right text-lg font-bold text-brand-600">
                {formatMoney(data.grand_total)}
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="text-ink-400">
          No catalog items placed yet. Place furniture/appliances to build a BOM.
        </p>
      )}
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
            className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{m.user.full_name}</span>{" "}
              <span className="text-ink-400">{m.user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-ink-100 px-2 py-0.5 text-xs">{m.role}</span>
              {m.role !== "owner" && (
                <button
                  className="text-red-400"
                  onClick={() => remove.mutate(m.id)}
                >
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
              className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-sm"
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
