"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type WorkflowAction = { key: string; label: string; requiresReason?: boolean };

export function WorkflowBar({
  reviewId,
  actions,
  disabledHint,
}: {
  reviewId: string;
  actions: WorkflowAction[];
  disabledHint?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<string | null>(null);

  function run(key: string, why?: string) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/reviews/${reviewId}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionKey: key, reason: why }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Transition failed");
        setAsking(null);
        return;
      }
      setAsking(null);
      setReason("");
      router.refresh();
    });
  }

  function rerun() {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/reviews/${reviewId}/preflight`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Preflight failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <span key={action.key} className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => (action.requiresReason ? setAsking(action.key) : run(action.key))}
              className="rounded-md bg-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {action.label} →
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={rerun}
          className="rounded-md border border-line bg-white px-3.5 py-2 text-sm font-medium hover:border-slate-400 disabled:opacity-50"
          title="Re-run every check. Accepted fixes that are now absent disappear; decisions carry over."
        >
          Re-run preflight
        </button>
        <a
          href={`/api/export/${reviewId}`}
          className="rounded-md border border-line bg-white px-3.5 py-2 text-sm font-medium hover:border-slate-400"
          title="Download the approval record: sign-off chain, decisions, guideline version, AI disclosure."
        >
          Export approval record
        </a>
      </div>

      {asking && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-2">
          <label className="text-xs font-medium" htmlFor="transition-reason">
            Reason ({asking === "request_changes" ? "required" : "optional"}):
          </label>
          <input
            id="transition-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={asking === "request_changes" ? "What must change before approval?" : ""}
            className="min-w-72 flex-1 rounded border border-line px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={pending || (asking === "request_changes" && reason.trim().length < 4)}
            onClick={() => run(asking, reason)}
            className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Confirm
          </button>
          <button type="button" onClick={() => setAsking(null)} className="rounded-md border border-line px-3 py-1.5 text-xs">
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {disabledHint && !error && (
        <p className="text-xs text-slate-500">{disabledHint}</p>
      )}
    </div>
  );
}
