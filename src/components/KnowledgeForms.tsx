"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Kind = "term" | "fact" | "clause" | "guideline";

const TABS: { key: Kind; label: string }[] = [
  { key: "term", label: "Add terminology" },
  { key: "fact", label: "Register a fact" },
  { key: "clause", label: "Add a clause" },
  { key: "guideline", label: "Import a guideline (new version)" },
];

export function KnowledgeForms({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Kind>("term");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function set(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: tab, ...fields }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: json.error ?? "Could not save" });
        return;
      }
      setMessage({ ok: true, text: "Saved. New reviews will cite it from now on." });
      setFields({});
      router.refresh();
    });
  }

  if (!canEdit) {
    return (
      <p className="rounded-xl border border-line bg-white px-5 py-4 text-sm text-slate-600">
        You are acting as a read-only role. Switch to <strong>Admin</strong> or{" "}
        <strong>Content Manager</strong> (top right) to change the knowledge base.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === t.key ? "bg-ink text-white" : "border border-line text-slate-600 hover:border-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {tab === "term" && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Term</span>
              <input
                value={fields.term ?? ""}
                onChange={(e) => set("term", e.target.value)}
                placeholder="e.g. detox"
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Kind</span>
              <select
                value={fields.termKind ?? "banned"}
                onChange={(e) => set("termKind", e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2"
              >
                <option value="banned">Banned</option>
                <option value="approved">Approved</option>
                <option value="product_name">Product / company name</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Approved replacement (optional)</span>
              <input
                value={fields.replacement ?? ""}
                onChange={(e) => set("replacement", e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Note</span>
              <input
                value={fields.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          </>
        )}

        {tab === "fact" && (
          <>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Claim (as it may appear in content)</span>
              <input
                value={fields.claim ?? ""}
                onChange={(e) => set("claim", e.target.value)}
                placeholder="e.g. 94% of participants reported feeling more relaxed within 14 days"
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Source</span>
              <input
                value={fields.source ?? ""}
                onChange={(e) => set("source", e.target.value)}
                placeholder="e.g. Internal study, n=412, 2025"
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Review date</span>
              <input
                type="date"
                value={fields.reviewDate ?? ""}
                onChange={(e) => set("reviewDate", e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          </>
        )}

        {tab === "clause" && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Title</span>
              <input
                value={fields.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Newsletter tone"
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Channel (optional)</span>
              <input
                value={fields.channel ?? ""}
                onChange={(e) => set("channel", e.target.value)}
                placeholder="e.g. email"
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Clause body (this text is what findings quote)</span>
              <textarea
                value={fields.body ?? ""}
                onChange={(e) => set("body", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        {tab === "guideline" && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Version label</span>
              <input
                value={fields.label ?? ""}
                onChange={(e) => set("label", e.target.value)}
                placeholder="e.g. Brand Book v2.0"
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Source name</span>
              <input
                value={fields.sourceName ?? ""}
                onChange={(e) => set("sourceName", e.target.value)}
                placeholder="e.g. brand-book-v2.pdf"
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">
                Paste the guideline text (blank lines separate clauses; a new version is created)
              </span>
              <textarea
                value={fields.text ?? ""}
                onChange={(e) => set("text", e.target.value)}
                rows={6}
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
              />
            </label>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save to knowledge base"}
        </button>
        {message && (
          <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
            {message.text}
          </span>
        )}
      </div>
    </section>
  );
}
