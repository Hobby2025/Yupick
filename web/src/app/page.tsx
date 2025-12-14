export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Yupick
          </h1>
          <p className="text-base leading-7 text-zinc-600">
            유튜브 댓글 이벤트 응모를 수집하고 필터링/추첨을 진행하는 관리자
            도구
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-900">시작하기</div>
              <div className="text-sm text-zinc-600">
                이벤트를 만들고 댓글을 수집해보세요.
              </div>
            </div>
            <a
              className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              href="/events"
            >
              이벤트 관리로 이동
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
