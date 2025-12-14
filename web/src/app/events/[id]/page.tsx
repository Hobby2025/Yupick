import { prisma } from "@/lib/prisma";

import CollectComments from "./ui/collect-comments";
import CommentsPanel from "./ui/comments-panel";
import DeleteEventButton from "./ui/delete-event";

export default async function EventDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let event: {
    id: string;
    name: string | null;
    videoUrl: string;
    videoId: string;
    lastCollectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { comments: number };
  } | null = null;

  try {
    event = await prisma.event.findUnique({
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
      },
    });
  } catch (e) {
    console.error("RSC /events/[id] prisma error", { id }, e);

    return (
      <div className="min-h-screen bg-zinc-50">
        <main className="mx-auto w-full max-w-4xl px-6 py-12">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-medium text-zinc-900">
              이벤트 정보를 불러오지 못했습니다.
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              Vercel 로그에서 에러 원인을 확인해주세요. (DB 연결/환경변수/권한
              문제일 수 있습니다.)
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
          <div className="flex items-center gap-3">
            <DeleteEventButton eventId={event.id} />
            <a
              className="text-sm text-zinc-700 hover:text-zinc-900"
              href="/events"
            >
              목록
            </a>
          </div>
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

        <CommentsPanel eventId={event.id} />
      </main>
    </div>
  );
}
