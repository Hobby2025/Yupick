"use client";

import { useEffect, useMemo, useState } from "react";

type CommentItem = {
  id: string;
  commentId: string;
  authorName: string | null;
  authorChannelId: string | null;
  text: string;
  publishedAt: string | null;
  createdAt: string;
};

export default function CommentsPanel(props: { eventId: string }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);

  const identifiable = useMemo(() => {
    return comments.filter((c) => (c.authorChannelId ?? "").trim().length > 0);
  }, [comments]);

  const unidentifiable = useMemo(() => {
    return comments.filter(
      (c) => (c.authorChannelId ?? "").trim().length === 0
    );
  }, [comments]);

  const usersCsvHref = useMemo(() => {
    const url = new URL(
      `/api/events/${props.eventId}/comments`,
      window.location.origin
    );
    if (q.trim()) url.searchParams.set("q", q.trim());
    url.searchParams.set("format", "csv");
    url.searchParams.set("type", "users");
    return url.toString();
  }, [props.eventId, q]);

  const commentsCsvHref = useMemo(() => {
    const url = new URL(
      `/api/events/${props.eventId}/comments`,
      window.location.origin
    );
    if (q.trim()) url.searchParams.set("q", q.trim());
    url.searchParams.set("format", "csv");
    url.searchParams.set("type", "comments");
    return url.toString();
  }, [props.eventId, q]);

  async function load(nextQ: string) {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(
        `/api/events/${props.eventId}/comments`,
        window.location.origin
      );
      if (nextQ.trim()) url.searchParams.set("q", nextQ.trim());

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { comments: CommentItem[] }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed to load";
        throw new Error(msg);
      }

      setComments(data && "comments" in data ? data.comments : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(q);
    }, 250);

    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void load("");
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium text-zinc-900">댓글</div>
          <div className="text-xs text-zinc-600">
            {loading ? "불러오는 중..." : `${comments.length}개`}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 sm:w-72"
            placeholder="검색(작성자/댓글/ID)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <a
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-800 hover:bg-zinc-50"
            href={usersCsvHref}
          >
            유저 CSV 내보내기
          </a>
          <a
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-800 hover:bg-zinc-50"
            href={commentsCsvHref}
          >
            댓글 CSV 내보내기
          </a>
        </div>
      </div>

      {error ? (
        <div className="px-6 py-4 text-sm text-red-600">{error}</div>
      ) : null}

      {loading ? (
        <div className="px-6 py-6 text-sm text-zinc-600">불러오는 중...</div>
      ) : comments.length === 0 ? (
        <div className="px-6 py-6 text-sm text-zinc-600">댓글이 없습니다.</div>
      ) : (
        <div>
          <div className="border-b border-zinc-200 px-6 py-3 text-xs font-medium text-zinc-700">
            식별 가능(authorChannelId 있음): {identifiable.length}개
          </div>
          {identifiable.length === 0 ? (
            <div className="px-6 py-6 text-sm text-zinc-600">없음</div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {identifiable.map((c) => (
                <li key={c.id} className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-zinc-900">
                      {c.authorName || "(알 수 없음)"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      channelId: {c.authorChannelId}
                    </div>
                    <div className="text-xs text-zinc-500">
                      commentId: {c.commentId}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                      {c.text}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {c.publishedAt
                        ? new Date(c.publishedAt).toLocaleString()
                        : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 border-b border-zinc-200 px-6 py-3 text-xs font-medium text-zinc-700">
            식별 불가(authorChannelId 없음): {unidentifiable.length}개
          </div>
          {unidentifiable.length === 0 ? (
            <div className="px-6 py-6 text-sm text-zinc-600">없음</div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {unidentifiable.map((c) => (
                <li key={c.id} className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-zinc-900">
                      {c.authorName || "(알 수 없음)"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      commentId: {c.commentId}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                      {c.text}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {c.publishedAt
                        ? new Date(c.publishedAt).toLocaleString()
                        : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
