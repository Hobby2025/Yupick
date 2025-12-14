import { prisma } from "@/lib/prisma";

import CollectComments from "./ui/collect-comments";

export default async function EventDetailPage(props: {
  params: { id: string };
}) {
  const { id } = props.params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      videoUrl: true,
      videoId: true,
      lastCollectedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { comments: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          commentId: true,
          authorName: true,
          text: true,
          publishedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!event) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <main className="mx-auto w-full max-w-4xl px-6 py-12">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-medium text-zinc-900">
              이벤트가 없습니다.
            </div>
            <a
              className="mt-3 inline-block text-sm text-zinc-700 hover:text-zinc-900"
              href="/events"
            >
              목록으로
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              {event.name || "(이름 없음)"}
            </h1>
            <div className="mt-1 text-sm text-zinc-600">
              videoId: {event.videoId}
            </div>
            <div className="mt-1 text-xs text-zinc-500 break-all">
              {event.videoUrl}
            </div>
          </div>
          <a
            className="text-sm text-zinc-700 hover:text-zinc-900"
            href="/events"
          >
            목록
          </a>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-900">댓글 수집</div>
              <div className="text-xs text-zinc-600">
                현재 저장된 댓글: {event._count.comments}개
              </div>
            </div>
            <CollectComments eventId={event.id} />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="text-sm font-medium text-zinc-900">
              최근 댓글 20개
            </div>
          </div>

          {event.comments.length === 0 ? (
            <div className="px-6 py-6 text-sm text-zinc-600">
              저장된 댓글이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {event.comments.map((c) => (
                <li key={c.id} className="px-6 py-4">
                  <div className="text-sm text-zinc-900">
                    {c.authorName ? (
                      <span className="font-medium">{c.authorName}</span>
                    ) : (
                      <span className="font-medium">(알 수 없음)</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-zinc-700 whitespace-pre-wrap">
                    {c.text}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {c.publishedAt
                      ? new Date(c.publishedAt).toLocaleString()
                      : ""}
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
