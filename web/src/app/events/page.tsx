"use client";

import { useEffect, useMemo, useState } from "react";

type EventItem = {
  id: string;
  name: string | null;
  videoUrl: string;
  videoId: string;
  lastCollectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { comments: number };
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const canCreate = useMemo(() => {
    return videoUrl.trim().length > 0 && !creating;
  }, [videoUrl, creating]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = (await res.json()) as {
        events?: EventItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load events");

      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function createEvent() {
    if (!canCreate) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, videoUrl }),
      });

      const data = (await res.json()) as { event?: EventItem; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to create event");

      setName("");
      setVideoUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-zinc-900">이벤트</h1>
          <p className="text-sm text-zinc-600">
            유튜브 영상 URL로 이벤트를 만들고 댓글을 수집합니다.
          </p>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 text-sm font-medium text-zinc-900">
            이벤트 생성
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="이벤트 이름(선택)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400 sm:col-span-2"
              placeholder="YouTube 영상 URL 또는 Video ID"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              예: https://www.youtube.com/watch?v=... / https://youtu.be/... /
              shorts
            </div>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              onClick={() => void createEvent()}
              disabled={!canCreate}
            >
              {creating ? "생성 중..." : "생성"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div className="text-sm font-medium text-zinc-900">이벤트 목록</div>
            <button
              className="text-sm text-zinc-700 hover:text-zinc-900"
              onClick={() => void load()}
            >
              새로고침
            </button>
          </div>

          {error ? (
            <div className="px-6 py-4 text-sm text-red-600">{error}</div>
          ) : null}

          {loading ? (
            <div className="px-6 py-6 text-sm text-zinc-600">
              불러오는 중...
            </div>
          ) : events.length === 0 ? (
            <div className="px-6 py-6 text-sm text-zinc-600">
              아직 이벤트가 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {events.map((ev) => (
                <li key={ev.id} className="px-6 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-zinc-900">
                        {ev.name || "(이름 없음)"}
                      </div>
                      <div className="text-xs text-zinc-600">
                        videoId: {ev.videoId} · 댓글 {ev._count.comments}개
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {ev.videoUrl}
                      </div>
                    </div>
                    <a
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 hover:bg-zinc-50"
                      href={`/events/${ev.id}`}
                    >
                      상세
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
