import type { Finding, Review } from "@/lib/db/schema";
import { STATUS_LABEL, type Status } from "@/lib/workflow";

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    blocker: "bg-red-50 text-red-700 border-red-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        styles[severity] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SELF_REVIEW: "bg-sky-50 text-sky-700",
  READY_FOR_REVIEW: "bg-indigo-50 text-indigo-700",
  IN_REVIEW: "bg-violet-50 text-violet-700",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  PUBLISH_READY: "bg-green-100 text-green-800",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {STATUS_LABEL[status as Status] ?? status}
    </span>
  );
}

export function StateChip({ state }: { state: string }) {
  const map: Record<string, string> = {
    open: "bg-slate-100 text-slate-600",
    accepted: "bg-emerald-50 text-emerald-700",
    edited: "bg-emerald-50 text-emerald-700",
    dismissed: "bg-slate-100 text-slate-600 italic",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${map[state] ?? map.open}`}>
      {state}
    </span>
  );
}

/** Word-level diff renderer used by finding cards. */
export function DiffView({
  diff,
}: {
  diff: { op: "keep" | "del" | "ins"; text: string }[];
}) {
  if (!diff?.length) return null;
  return (
    <code className="block rounded border border-line bg-white p-2 text-[13px] leading-relaxed">
      {diff.map((part, i) => (
        <span
          key={i}
          className={
            part.op === "del"
              ? "bg-red-100 text-red-800 line-through"
              : part.op === "ins"
                ? "bg-emerald-100 text-emerald-800"
                : "text-slate-700"
          }
        >
          {part.text}
        </span>
      ))}
    </code>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export type { Finding, Review };
