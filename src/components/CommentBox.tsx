"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CommentBox({ reviewId, findingId }: { reviewId: string; findingId?: string | null }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, findingId: findingId ?? null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not post the comment");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Add a comment for the thread…"
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || body.trim().length === 0}
          onClick={submit}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Comment
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
