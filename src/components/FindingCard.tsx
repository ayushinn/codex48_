"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DiffView, SeverityBadge, StateChip } from "@/components/ui";

export type FindingView = {
  id: string;
  seq: number;
  checkGroup: string;
  severity: string;
  ruleType: string;
  clauseCode: string | null;
  clauseQuote: string | null;
  why: string;
  quote: string | null;
  suggestion: string | null;
  diff: { op: "keep" | "del" | "ins"; text: string }[];
  confidence: string;
  state: string;
  editedText: string | null;
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  isBlocker: boolean;
};

export type CommentView = {
  id: string;
  findingId: string | null;
  author: string;
  body: string;
  createdAt: string;
};

export function FindingCard({
  reviewId,
  finding,
  role,
  comments,
  clauseTitle,
  clauseSection,
}: {
  reviewId: string;
  finding: FindingView;
  role: string;
  comments: CommentView[];
  clauseTitle?: string;
  clauseSection?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "edit" | "dismiss">("view");
  const [replacement, setReplacement] = useState(finding.suggestion ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canDecide = ["creator", "manager", "admin"].includes(role) && finding.state === "open";
  const anchored = comments.filter((c) => c.findingId === finding.id);

  function post(body: Record<string, unknown>, after?: () => void) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/reviews/${reviewId}/findings/${finding.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Action failed");
        return;
      }
      setMode("view");
      setReason("");
      after?.();
      router.refresh();
    });
  }

  return (
    <article
      id={`f-${finding.id}`}
      className={`rounded-lg border bg-white ${
        finding.state === "open" ? "border-line" : "border-line opacity-80"
      }`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <SeverityBadge severity={finding.severity} />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {finding.checkGroup} · {finding.ruleType}
        </span>
        <StateChip state={finding.state} />
        {finding.confidence === "low" && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            judgement call · low confidence
          </span>
        )}
        {finding.state === "open" && <span className="ml-auto text-xs text-slate-400">#{finding.seq}</span>}
      </header>

      <div className="space-y-3 px-4 py-3 text-sm">
        <p className="leading-relaxed">{finding.why}</p>

        <div className="rounded-md border border-line bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Guideline clause {finding.clauseCode}
            {clauseSection ? ` · ${clauseSection}` : ""}
            {clauseTitle ? ` · ${clauseTitle}` : ""}
          </p>
          <blockquote className="mt-1 border-l-2 border-slate-300 pl-3 font-mono text-[13px] leading-relaxed text-slate-700">
            “{finding.clauseQuote}”
          </blockquote>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Verbatim quote, matched back to the stored clause by the citation verifier.
          </p>
        </div>

        {finding.quote && (
          <div className="rounded-md border border-line bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              In this draft ({finding.quote.length} characters)
            </p>
            <p className="mt-1 font-mono text-[13px] leading-relaxed text-slate-800">
              …{finding.quote}…
            </p>
          </div>
        )}

        {finding.diff.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Suggested correction (intent-preserving)
            </p>
            <DiffView diff={finding.diff} />
          </div>
        )}

        {finding.state !== "open" && (
          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              <span className="font-semibold">{finding.decidedBy}</span> marked this{" "}
              <strong>{finding.state}</strong>
              {finding.decidedAt ? ` on ${new Date(finding.decidedAt).toLocaleString()}` : ""}.
            </p>
            {finding.editedText && finding.state === "edited" && (
              <p className="mt-1 font-mono">Applied wording: “{finding.editedText}”</p>
            )}
            {finding.decisionReason && <p className="mt-1">Reason: {finding.decisionReason}</p>}
          </div>
        )}

        {anchored.length > 0 && (
          <ul className="space-y-2 border-l-2 border-indigo-100 pl-3">
            {anchored.map((c) => (
              <li key={c.id} className="text-xs">
                <span className="font-semibold">{c.author}</span>{" "}
                <span className="text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                <p className="text-slate-700">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            {error}
          </p>
        )}

        {mode === "edit" && (
          <div className="space-y-2">
            <textarea
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-line px-3 py-2 font-mono text-[13px]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => post({ decision: "edit", replacement })}
                className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Apply my wording
              </button>
              <button
                type="button"
                onClick={() => setMode("view")}
                className="rounded-md border border-line px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === "dismiss" && (
          <div className="space-y-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium">
                Why are you dismissing this? (required — feeds guideline-gap analysis)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Guide has no channel exception for newsletter intros."
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || reason.trim().length < 4}
                onClick={() => post({ decision: "dismiss", reason })}
                className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Dismiss with reason
              </button>
              <button type="button" onClick={() => setMode("view")} className="rounded-md border border-line px-3 py-1.5 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {canDecide && mode === "view" && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {finding.suggestion !== null && finding.suggestion !== undefined ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => post({ decision: "accept" })}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Accept suggestion
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setMode("edit");
                setReplacement(finding.suggestion ?? finding.quote ?? "");
              }}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-slate-400 disabled:opacity-50"
            >
              Edit instead
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("dismiss")}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-slate-400 disabled:opacity-50"
            >
              Dismiss…
            </button>
          </div>
        )}

        {finding.state === "open" && !canDecide && (
          <p className="border-t border-line pt-3 text-xs text-slate-500">
            {role === "reviewer"
              ? "Authorised Reviewers are read-only on content and findings; you can verify claims and sign off."
              : "Switch to the Creator persona to resolve findings."}
          </p>
        )}
      </div>
    </article>
  );
}
