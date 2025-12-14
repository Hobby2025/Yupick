"use client";

export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-16">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-medium">
              페이지 처리 중 오류가 발생했습니다.
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              아래 digest를 기준으로 Vercel Functions/Runtime 로그를
              확인해주세요.
            </div>
            {props.error.digest ? (
              <div className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-800">
                digest: {props.error.digest}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                onClick={() => props.reset()}
              >
                다시 시도
              </button>
              <a
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-800 hover:bg-zinc-50"
                href="/events"
              >
                이벤트로 이동
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
