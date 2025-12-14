"use client";

import { useEffect, useMemo, useState } from "react";

type PrizeItem = {
  id: string;
  name: string;
  quantity: number;
  _count: { candidates: number; winners: number };
};

type WinnerItem = {
  id: string;
  createdAt: string;
  candidate: {
    id: string;
    userKey: string;
    authorName: string | null;
    authorChannelId: string | null;
  };
};

export default function PrizesPanel(props: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);

  const [newPrizeName, setNewPrizeName] = useState("");
  const [newPrizeQty, setNewPrizeQty] = useState(1);

  const [candidateQ, setCandidateQ] = useState("");
  const [winners, setWinners] = useState<Record<string, WinnerItem[]>>({});

  const canCreatePrize = useMemo(
    () => newPrizeName.trim().length > 0,
    [newPrizeName]
  );

  async function loadPrizes() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${props.eventId}/prizes`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | { prizes: PrizeItem[] }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed to load";
        throw new Error(msg);
      }

      setPrizes(data && "prizes" in data ? data.prizes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function clearCandidates(prizeId: string) {
    const ok = window.confirm("이 상품의 후보/당첨을 모두 초기화할까요?");
    if (!ok) return;

    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prizeId}/candidates`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => null)) as
        | { ok: true; deletedCandidates: number }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed";
        throw new Error(msg);
      }

      setWinners((prev) => {
        const next = { ...prev };
        delete next[prizeId];
        return next;
      });

      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function deletePrize(prizeId: string) {
    const ok = window.confirm(
      "이 상품을 삭제할까요? (후보/당첨 결과도 함께 삭제됩니다)"
    );
    if (!ok) return;

    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prizeId}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed";
        throw new Error(msg);
      }

      setWinners((prev) => {
        const next = { ...prev };
        delete next[prizeId];
        return next;
      });

      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function createPrize() {
    if (!canCreatePrize) return;

    setError(null);

    try {
      const res = await fetch(`/api/events/${props.eventId}/prizes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newPrizeName.trim(),
          quantity: newPrizeQty,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { prize: PrizeItem }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed to create";
        throw new Error(msg);
      }

      setNewPrizeName("");
      setNewPrizeQty(1);
      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function buildCandidates(prizeId: string) {
    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prizeId}/candidates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            q: candidateQ.trim() || undefined,
            replace: true,
          }),
        }
      );
      const data = (await res.json().catch(() => null)) as
        | { createdCount: number; totalCandidates: number }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed";
        throw new Error(msg);
      }

      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function loadWinners(prizeId: string) {
    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prizeId}/draw`,
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => null)) as
        | { winners: WinnerItem[] }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed";
        throw new Error(msg);
      }

      setWinners((prev) => ({
        ...prev,
        [prizeId]: data && "winners" in data ? data.winners : [],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function draw(prizeId: string) {
    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prizeId}/draw`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = (await res.json().catch(() => null)) as
        | { drawnCount: number; winners: WinnerItem[] }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed";
        throw new Error(msg);
      }

      setWinners((prev) => ({
        ...prev,
        [prizeId]: data && "winners" in data ? data.winners : [],
      }));
      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  useEffect(() => {
    void loadPrizes();
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-6 py-4">
        <div className="text-sm font-medium text-zinc-900">경품 / 추첨</div>
      </div>

      {error ? (
        <div className="px-6 py-4 text-sm text-red-600">{error}</div>
      ) : null}

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 sm:col-span-2"
            placeholder="상품명(예: 에어팟)"
            value={newPrizeName}
            onChange={(e) => setNewPrizeName(e.target.value)}
          />
          <input
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400"
            type="number"
            min={1}
            value={newPrizeQty}
            onChange={(e) => setNewPrizeQty(Number(e.target.value))}
          />
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={!canCreatePrize}
            onClick={() => void createPrize()}
          >
            상품 추가
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 sm:col-span-3"
            placeholder="후보 생성 필터(선택): 작성자/댓글/ID 검색어"
            value={candidateQ}
            onChange={(e) => setCandidateQ(e.target.value)}
          />
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-800 hover:bg-zinc-50"
            onClick={() => void loadPrizes()}
          >
            새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <div className="px-6 py-6 text-sm text-zinc-600">불러오는 중...</div>
      ) : prizes.length === 0 ? (
        <div className="px-6 py-6 text-sm text-zinc-600">
          아직 상품이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {prizes.map((p) => (
            <li key={p.id} className="px-6 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-zinc-900">
                    {p.name}
                  </div>
                  <div className="text-xs text-zinc-600">
                    수량 {p.quantity} · 후보 {p._count.candidates} · 당첨{" "}
                    {p._count.winners}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 hover:bg-zinc-50"
                    onClick={() => void buildCandidates(p.id)}
                  >
                    후보 리스트 만들기
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => void clearCandidates(p.id)}
                  >
                    후보 초기화
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800"
                    onClick={() => void draw(p.id)}
                  >
                    추첨
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 hover:bg-zinc-50"
                    onClick={() => void loadWinners(p.id)}
                  >
                    당첨자 보기
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => void deletePrize(p.id)}
                  >
                    상품 삭제
                  </button>
                </div>
              </div>

              {winners[p.id] && winners[p.id].length > 0 ? (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-2 text-xs font-medium text-zinc-700">
                    당첨자
                  </div>
                  <ul className="space-y-1">
                    {winners[p.id].map((w) => (
                      <li key={w.id} className="text-sm text-zinc-800">
                        {w.candidate.authorName || "(이름 없음)"}
                        {w.candidate.authorChannelId
                          ? ` / ${w.candidate.authorChannelId}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
