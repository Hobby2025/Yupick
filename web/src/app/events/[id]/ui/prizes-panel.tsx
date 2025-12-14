"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type CandidateItem = {
  id: string;
  userKey: string;
  authorName: string | null;
  authorChannelId: string | null;
  createdAt: string;
};

function ScratchOverlay(props: { disabled: boolean; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const completedRef = useRef(false);

  function drawLayer() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${Math.floor(rect.width)}px`;
    canvas.style.height = `${Math.floor(rect.height)}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#e4e4e7");
    grad.addColorStop(1, "#d4d4d8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(24,24,27,0.55)";
    ctx.font = "600 12px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("긁어서 확인", w / 2, h / 2);
  }

  function scratchAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function estimateClearedRatio(): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;

    const { width, height } = canvas;
    const step = 12;
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;

    let cleared = 0;
    let total = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4 + 3;
        total += 1;
        if (data[idx] === 0) cleared += 1;
      }
    }

    return total === 0 ? 0 : cleared / total;
  }

  useEffect(() => {
    if (props.disabled) return;
    completedRef.current = false;
    drawLayer();

    const onResize = () => {
      if (props.disabled) return;
      if (completedRef.current) return;
      drawLayer();
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [props.disabled]);

  if (props.disabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 cursor-grab touch-none"
      onPointerDown={(e) => {
        drawingRef.current = true;
        (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
        scratchAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!drawingRef.current) return;
        scratchAt(e.clientX, e.clientY);
        if (completedRef.current) return;
        const ratio = estimateClearedRatio();
        if (ratio >= 0.45) {
          completedRef.current = true;
          props.onComplete();
        }
      }}
      onPointerUp={() => {
        drawingRef.current = false;
      }}
      onPointerCancel={() => {
        drawingRef.current = false;
      }}
    />
  );
}

export default function PrizesPanel(props: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);

  const [newPrizeName, setNewPrizeName] = useState("");
  const [newPrizeQty, setNewPrizeQty] = useState(1);

  const [candidateQ, setCandidateQ] = useState("");
  const [winners, setWinners] = useState<Record<string, WinnerItem[]>>({});
  const [candidates, setCandidates] = useState<
    Record<string, CandidateItem[] | undefined>
  >({});
  const [manageOpen, setManageOpen] = useState<Record<string, boolean>>({});
  const [manageTab, setManageTab] = useState<
    Record<string, "candidates" | "winners">
  >({});

  const [drawOpen, setDrawOpen] = useState(false);
  const [drawPrizeId, setDrawPrizeId] = useState<string | null>(null);
  const [drawPrizeName, setDrawPrizeName] = useState<string>("");
  const [drawPhase, setDrawPhase] = useState<
    "idle" | "loading" | "rolling" | "reveal" | "done" | "error"
  >("idle");
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawWinners, setDrawWinners] = useState<WinnerItem[]>([]);
  const [scratched, setScratched] = useState<Record<string, boolean>>({});
  const [revealCount, setRevealCount] = useState(0);
  const [rollingLabel, setRollingLabel] = useState<string>("");
  const rollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  function closeDraw() {
    setDrawOpen(false);
    setDrawPrizeId(null);
    setDrawPrizeName("");
    setDrawPhase("idle");
    setDrawError(null);
    setDrawWinners([]);
    setScratched({});
    setRevealCount(0);
    setRollingLabel("");
  }

  async function startDrawGame(prize: PrizeItem) {
    setError(null);
    setDrawError(null);
    setDrawOpen(true);
    setDrawPrizeId(prize.id);
    setDrawPrizeName(prize.name);
    setDrawPhase("loading");
    setDrawWinners([]);
    setScratched({});
    setRevealCount(0);
    setRollingLabel("");

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prize.id}/draw`,
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

      const winnersList = data && "winners" in data ? data.winners : [];
      setWinners((prev) => ({ ...prev, [prize.id]: winnersList }));
      setDrawWinners(winnersList);

      setManageOpen((prev) => ({ ...prev, [prize.id]: true }));
      setManageTab((prev) => ({ ...prev, [prize.id]: "winners" }));

      setDrawPhase("rolling");

      const poolFromCandidates = candidates[prize.id] ?? [];
      const pool =
        poolFromCandidates.length > 0
          ? poolFromCandidates.map((c) => c.authorName || "(이름 없음)")
          : winnersList.map((w) => w.candidate.authorName || "(이름 없음)");
      const safePool = pool.length > 0 ? pool : ["(후보 없음)"];

      setRollingLabel(safePool[0] ?? "(후보 없음)");
      rollingTimerRef.current = setInterval(() => {
        const idx = Math.floor(Math.random() * safePool.length);
        setRollingLabel(safePool[idx] ?? "(후보 없음)");
      }, 90);

      rollingStopRef.current = setTimeout(() => {
        if (rollingTimerRef.current) {
          clearInterval(rollingTimerRef.current);
          rollingTimerRef.current = null;
        }

        setRollingLabel("");
        setDrawPhase("reveal");

        const total = winnersList.length;
        if (total === 0) {
          setRevealCount(0);
          setDrawPhase("done");
          return;
        }

        setRevealCount(0);
        revealTimerRef.current = setInterval(() => {
          setRevealCount((prev) => {
            const next = prev + 1;
            if (next >= total) {
              if (revealTimerRef.current) {
                clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
              }
              setDrawPhase("done");
              return total;
            }
            return next;
          });
        }, 900);
      }, 1700);

      await loadPrizes();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setDrawError(msg);
      setDrawPhase("error");
      setError(msg);
    }
  }

  async function loadCandidates(prizeId: string) {
    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prizeId}/candidates`,
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => null)) as
        | { candidates: CandidateItem[] }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed";
        throw new Error(msg);
      }

      setCandidates((prev) => ({
        ...prev,
        [prizeId]: data && "candidates" in data ? data.candidates : [],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function openManage(prizeId: string) {
    const nextOpen = !manageOpen[prizeId];
    setManageOpen((prev) => ({ ...prev, [prizeId]: nextOpen }));
    if (!nextOpen) return;

    const tab = manageTab[prizeId] ?? "candidates";
    setManageTab((prev) => ({ ...prev, [prizeId]: tab }));

    if (tab === "winners") {
      await loadWinners(prizeId);
    } else {
      await loadCandidates(prizeId);
    }
  }

  async function setTab(prizeId: string, tab: "candidates" | "winners") {
    setManageTab((prev) => ({ ...prev, [prizeId]: tab }));
    if (tab === "winners") {
      await loadWinners(prizeId);
    } else {
      await loadCandidates(prizeId);
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

      setCandidates((prev) => {
        return { ...prev, [prizeId]: [] };
      });

      if (
        manageOpen[prizeId] &&
        (manageTab[prizeId] ?? "candidates") === "candidates"
      ) {
        await loadCandidates(prizeId);
      }
      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function removeCandidate(prizeId: string, candidateId: string) {
    const ok = window.confirm("이 후보를 제외할까요?");
    if (!ok) return;

    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${prizeId}/candidates/${candidateId}`,
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

      await loadCandidates(prizeId);
      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function moveCandidate(
    fromPrizeId: string,
    candidateId: string,
    toPrizeId: string
  ) {
    if (!toPrizeId) return;

    setError(null);

    try {
      const res = await fetch(
        `/api/events/${props.eventId}/prizes/${fromPrizeId}/candidates/${candidateId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ toPrizeId }),
        }
      );
      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { error: string }
        | null;

      if (!res.ok) {
        const msg = data && "error" in data ? data.error : "Failed";
        throw new Error(msg);
      }

      await Promise.all([
        loadCandidates(fromPrizeId),
        manageOpen[toPrizeId] ? loadCandidates(toPrizeId) : Promise.resolve(),
      ]);
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

      setCandidates((prev) => {
        const next = { ...prev };
        delete next[prizeId];
        return next;
      });

      setManageOpen((prev) => {
        const next = { ...prev };
        delete next[prizeId];
        return next;
      });

      setManageTab((prev) => {
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

      if (
        manageOpen[prizeId] &&
        (manageTab[prizeId] ?? "candidates") === "candidates"
      ) {
        await loadCandidates(prizeId);
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

  useEffect(() => {
    return () => {
      if (rollingTimerRef.current) clearInterval(rollingTimerRef.current);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      if (rollingStopRef.current) clearTimeout(rollingStopRef.current);
    };
  }, []);

  useEffect(() => {
    if (!drawOpen) {
      if (rollingTimerRef.current) {
        clearInterval(rollingTimerRef.current);
        rollingTimerRef.current = null;
      }
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      if (rollingStopRef.current) {
        clearTimeout(rollingStopRef.current);
        rollingStopRef.current = null;
      }
    }
  }, [drawOpen]);

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
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800"
                    onClick={() => void startDrawGame(p)}
                  >
                    추첨
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 hover:bg-zinc-50"
                    onClick={() => void openManage(p.id)}
                  >
                    {manageOpen[p.id] ? "관리 닫기" : "관리"}
                  </button>
                </div>
              </div>

              {manageOpen[p.id] ? (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white">
                  <div className="flex flex-col gap-2 border-b border-zinc-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs ${
                          (manageTab[p.id] ?? "candidates") === "candidates"
                            ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                            : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        }`}
                        onClick={() => void setTab(p.id, "candidates")}
                      >
                        후보
                      </button>
                      <button
                        className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs ${
                          (manageTab[p.id] ?? "candidates") === "winners"
                            ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                            : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        }`}
                        onClick={() => void setTab(p.id, "winners")}
                      >
                        당첨자
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(manageTab[p.id] ?? "candidates") === "candidates" ? (
                        <>
                          <button
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 px-3 text-xs text-zinc-800 hover:bg-zinc-50"
                            onClick={() => void buildCandidates(p.id)}
                          >
                            후보 재생성
                          </button>
                          <button
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 px-3 text-xs text-red-700 hover:bg-red-50"
                            onClick={() => void clearCandidates(p.id)}
                          >
                            후보 초기화
                          </button>
                        </>
                      ) : (
                        <button
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 px-3 text-xs text-zinc-800 hover:bg-zinc-50"
                          onClick={() => void loadWinners(p.id)}
                        >
                          새로고침
                        </button>
                      )}

                      <button
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 px-3 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => void deletePrize(p.id)}
                      >
                        상품 삭제
                      </button>
                    </div>
                  </div>

                  {(manageTab[p.id] ?? "candidates") === "candidates" ? (
                    !candidates[p.id] ? (
                      <div className="px-3 py-3 text-sm text-zinc-600">
                        불러오는 중...
                      </div>
                    ) : candidates[p.id]!.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-zinc-600">
                        후보가 없습니다.
                      </div>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {candidates[p.id]!.map((c) => (
                          <li
                            key={c.id}
                            className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900">
                                {c.authorName || "(이름 없음)"}
                              </div>
                              <div className="mt-0.5 text-xs text-zinc-600 break-all">
                                {c.authorChannelId || ""}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
                                value=""
                                onChange={(e) => {
                                  const toPrizeId = e.target.value;
                                  if (!toPrizeId) return;
                                  const ok = window.confirm(
                                    `이 후보를 '${
                                      prizes.find((x) => x.id === toPrizeId)
                                        ?.name ?? ""
                                    }'(으)로 이동할까요?`
                                  );
                                  if (!ok) return;
                                  void moveCandidate(p.id, c.id, toPrizeId);
                                }}
                              >
                                <option value="">다른 상품으로 이동</option>
                                {prizes
                                  .filter((pp) => pp.id !== p.id)
                                  .map((pp) => (
                                    <option key={pp.id} value={pp.id}>
                                      {pp.name}
                                    </option>
                                  ))}
                              </select>

                              <button
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
                                onClick={() => void removeCandidate(p.id, c.id)}
                              >
                                제외
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : !winners[p.id] ? (
                    <div className="px-3 py-3 text-sm text-zinc-600">
                      불러오는 중...
                    </div>
                  ) : winners[p.id].length === 0 ? (
                    <div className="px-3 py-3 text-sm text-zinc-600">
                      당첨자가 없습니다.
                    </div>
                  ) : (
                    <ul className="divide-y divide-zinc-100">
                      {winners[p.id].map((w) => (
                        <li
                          key={w.id}
                          className="px-3 py-3 text-sm text-zinc-800"
                        >
                          {w.candidate.authorName || "(이름 없음)"}
                          {w.candidate.authorChannelId
                            ? ` / ${w.candidate.authorChannelId}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {drawOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-600">추첨</div>
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {drawPrizeName}
                </div>
              </div>
              <button
                className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 hover:bg-zinc-50"
                onClick={() => closeDraw()}
              >
                닫기
              </button>
            </div>

            <div className="px-5 py-5">
              {drawPhase === "loading" ? (
                <div className="space-y-3">
                  <div className="text-sm text-zinc-800">추첨 준비중...</div>
                  <div className="h-24 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="h-full w-full animate-pulse rounded-lg bg-white" />
                  </div>
                </div>
              ) : drawPhase === "rolling" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-800">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                    섞는 중...
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-5">
                    <div className="text-xs font-medium text-zinc-600">
                      후보
                    </div>
                    <div className="mt-2 truncate text-2xl font-bold text-zinc-900">
                      {rollingLabel || ""}
                    </div>
                    <div className="mt-3 text-xs text-zinc-500">
                      잠시만요... 결과를 공개합니다
                    </div>
                  </div>
                </div>
              ) : drawPhase === "error" ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-red-700">
                    추첨 실패
                  </div>
                  <div className="text-sm text-zinc-700">
                    {drawError || "Unknown error"}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-900">
                      결과
                    </div>
                    {drawWinners.length > 0 && drawPhase !== "done" ? (
                      <button
                        className="text-sm text-zinc-700 hover:text-zinc-900"
                        onClick={() => {
                          if (revealTimerRef.current) {
                            clearInterval(revealTimerRef.current);
                            revealTimerRef.current = null;
                          }
                          setRevealCount(drawWinners.length);
                          setScratched(
                            Object.fromEntries(
                              drawWinners.map((w) => [w.id, true])
                            )
                          );
                          setDrawPhase("done");
                        }}
                      >
                        모두 공개
                      </button>
                    ) : null}
                  </div>

                  {drawWinners.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      더 이상 뽑을 후보가 없습니다.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {drawWinners.slice(0, revealCount).map((w, idx) => (
                        <li
                          key={w.id}
                          className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white"
                        >
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-zinc-600">
                                WIN #{idx + 1}
                              </div>
                              <div
                                className={`truncate text-sm font-semibold text-zinc-900 ${
                                  scratched[w.id] ? "" : "blur-sm select-none"
                                }`}
                              >
                                {w.candidate.authorName || "(이름 없음)"}
                              </div>
                              {w.candidate.authorChannelId ? (
                                <div
                                  className={`truncate text-xs text-zinc-500 ${
                                    scratched[w.id] ? "" : "blur-sm select-none"
                                  }`}
                                >
                                  {w.candidate.authorChannelId}
                                </div>
                              ) : null}
                            </div>
                            <div className="text-xs font-medium text-zinc-700">
                              당첨
                            </div>
                          </div>

                          <ScratchOverlay
                            disabled={!!scratched[w.id]}
                            onComplete={() =>
                              setScratched((prev) => ({
                                ...prev,
                                [w.id]: true,
                              }))
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {drawWinners.length > 0 ? (
                    <div className="text-xs text-zinc-500">
                      {Math.min(revealCount, drawWinners.length)}/
                      {drawWinners.length} 공개됨
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
