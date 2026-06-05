import { useState } from "react";
import {
  useComments,
  useCreateComment,
  useUpdateComment,
} from "@/api/hooks";
import { useEditor } from "@/store/editor";
import { Check, MessageSquarePlus } from "lucide-react";

export function CommentsPanel({
  projectId,
  floorId,
}: {
  projectId: number;
  floorId: number;
}) {
  const { data: comments } = useComments(projectId, floorId);
  const create = useCreateComment(projectId, floorId);
  const update = useUpdateComment(projectId, floorId);
  const { selectedId } = useEditor();
  const [body, setBody] = useState("");

  const add = async () => {
    if (!body.trim()) return;
    await create.mutateAsync({ body, element_id: selectedId ?? undefined });
    setBody("");
  };

  return (
    <div className="flex h-full flex-col">
      <p className="panel-title mb-2">Comments &amp; feedback</p>
      <div className="mb-3 flex gap-1">
        <input
          className="input"
          placeholder={
            selectedId ? "Comment on selected item…" : "Add a general note…"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn-primary !px-2" onClick={add}>
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto">
        {comments?.length ? (
          comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border p-2 text-sm ${
                c.resolved ? "border-ink-200 bg-ink-50 opacity-60" : "border-ink-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-600">
                  {c.author.full_name}
                </span>
                <button
                  className="text-ink-400 hover:text-emerald-600"
                  title={c.resolved ? "Resolved" : "Mark resolved"}
                  onClick={() =>
                    update.mutate({ id: c.id, body: { resolved: !c.resolved } })
                  }
                >
                  <Check className={`h-4 w-4 ${c.resolved ? "text-emerald-600" : ""}`} />
                </button>
              </div>
              <p className="mt-0.5 text-ink-700">{c.body}</p>
              {c.element_id && (
                <span className="text-xs text-ink-400">↳ on item #{c.element_id}</span>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-400">No comments yet.</p>
        )}
      </div>
    </div>
  );
}
