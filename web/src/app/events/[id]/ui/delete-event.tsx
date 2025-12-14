"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteEventButton(props: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(
      "이 이벤트를 삭제할까요? (저장된 댓글도 함께 삭제됩니다)"
    );
    if (!ok) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${props.eventId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed to delete";
        throw new Error(msg);
      }

      router.push("/events");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => void onDelete()}
        disabled={loading}
      >
        {loading ? "삭제 중..." : "삭제"}
      </button>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
