"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SelfApprovalToggle({ initial, isAdmin }: { initial: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setAllowed(next);
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowSelfApproval: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not update the setting");
        setAllowed(!next);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={allowed}
          disabled={!isAdmin || pending}
          onChange={(e) => toggle(e.target.checked)}
          className="h-4 w-4"
        />
        <span>Allow single-person sign-off (creator may approve their own content)</span>
      </label>
      {!isAdmin && (
        <span className="text-xs text-slate-500">Switch to the Admin persona to change this.</span>
      )}
      {pending && <span className="text-xs text-slate-500">Saving…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
