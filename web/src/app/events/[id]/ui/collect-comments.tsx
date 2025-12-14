"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CollectComments(props: { eventId: string }) {
  const router = useRouter();

  const [maxPages, setMaxPages] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  type CollectSuccess = {
    fetchedCount: number;
    createdCount: number;
    updatedCount: number;
  };

  type CollectError = { error: string };

  async function run() {
    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const res = await fetch(`/api/events/${props.eventId}/collect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxPages }),
      });

      const data = (await res.json()) as CollectSuccess | CollectError;

      if (!res.ok) {
        const err = "error" in data ? data.error : "Failed";
        throw new Error(err);
      }

      if ("error" in data) {
        throw new Error(data.error);
      }

      setMessage(
        `수집 완료: fetched=${data.fetchedCount}, created=${data.createdCount}, updated=${data.updatedCount}`
      );

      // server component 데이터 갱신
      router.refresh();
    } catch (e) {
      setIsError(true);
      setMessage(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <input
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 sm:w-28"
        type="number"
        min={1}
        max={25}
        value={maxPages}
        onChange={(e) => {
          const next = Number(e.target.value);
          setMaxPages(Number.isFinite(next) && next > 0 ? next : 1);
        }}
      />
      <button
        className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
        disabled={loading}
        onClick={() => void run()}
      >
        {loading ? "수집 중..." : "수집 실행"}
      </button>
      {message ? (
        <div
          className={isError ? "text-xs text-red-600" : "text-xs text-zinc-600"}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
