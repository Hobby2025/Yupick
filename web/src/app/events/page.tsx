"use client";

import Link from "next/link";
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

  const [notice, setNotice] = useState<{
    tone: "success" | "warning";
    message: string;
    eventId?: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function deleteEvent(id: string) {
    const ok = window.confirm(
      "이 이벤트를 삭제할까요? (저장된 댓글도 함께 삭제됩니다)"
    );
    if (!ok) return;

    setError(null);
    setNotice(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed to delete";
        throw new Error(msg);
      }

      await load();
      setNotice({ tone: "success", message: "삭제했습니다." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDeletingId(null);
    }
  }

  async function createEvent() {
    if (!canCreate) return;

    setCreating(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, videoUrl }),
      });

      const data = (await res.json().catch(() => null)) as {
        event?: EventItem;
        collect?: { fetchedCount: number; createdCount: number } | null;
        collectError?: string | null;
        error?: string;
      } | null;
      if (!res.ok) {
        const msg = data?.error || "Failed to create event";
        throw new Error(msg);
      }

      const createdEventId = data?.event?.id;
      if (data?.collectError) {
        setNotice({
          tone: "warning",
          message: `이벤트는 생성되었지만 초기 댓글 수집에 실패했습니다. (나중에 '댓글 수집'에서 다시 실행 가능)`,
          eventId: createdEventId,
        });
      } else if (data?.collect) {
        setNotice({
          tone: "success",
          message: `이벤트를 생성했습니다. (초기 댓글 ${data.collect.createdCount}개 저장)`,
          eventId: createdEventId,
        });
      } else {
        setNotice({
          tone: "success",
          message: "이벤트를 생성했습니다.",
          eventId: createdEventId,
        });
      }

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

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : notice ? (
          <div
            className={`rounded-xl border px-6 py-4 text-sm ${
              notice.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">{notice.message}</div>
              {notice.eventId ? (
                <Link
                  className="text-sm font-medium underline"
                  href={`/events/${notice.eventId}`}
                >
                  바로 열기
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 text-sm font-medium text-zinc-900">
            이벤트 생성
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400"
              placeholder="이벤트 이름(선택)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                void createEvent();
              }}
            />
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 sm:col-span-2"
              placeholder="YouTube 영상 URL 또는 Video ID"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                void createEvent();
              }}
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
              disabled={loading}
            >
              새로고침
            </button>
          </div>

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
                    <div className="flex items-center gap-2">
                      <Link
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 hover:bg-zinc-50"
                        href={`/events/${ev.id}`}
                      >
                        상세
                      </Link>
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
                        onClick={() => void deleteEvent(ev.id)}
                        disabled={deletingId === ev.id}
                      >
                        {deletingId === ev.id ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
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
