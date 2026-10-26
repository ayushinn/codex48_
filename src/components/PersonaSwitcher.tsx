"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PERSONAS } from "@/lib/personas";

export function PersonaSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const active = PERSONAS.find((p) => p.key === current) ?? PERSONAS[0];

  function choose(key: string) {
    startTransition(async () => {
      await fetch("/api/persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persona: key }),
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-slate-400"
        title="This build has no sign-in: pick the role you want to act as. Permissions are enforced server-side."
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[10px] font-semibold text-white">
          {active.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className="hidden sm:inline">
          <span className="block leading-tight">{active.name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{active.title}</span>
        </span>
        <span aria-hidden className="text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-line bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Act as (no sign-in in Round 2)
          </p>
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => choose(p.key)}
              className={`block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                p.key === active.key ? "bg-slate-100" : ""
              }`}
            >
              <span className="font-medium">{p.name}</span>
              <span className="block text-xs text-slate-500">{p.title}</span>
              <span className="block text-xs text-slate-500">{p.blurb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
