"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export default function PrizesPanel(props: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning";
    message: string;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
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
  const [revealCount, setRevealCount] = useState(0);
  const [raceStarted, setRaceStarted] = useState(false);
  const [raceIndex, setRaceIndex] = useState(0);
  const [raceLanes, setRaceLanes] = useState<
    {
      id: string;
      label: string;
      durationMs: number;
      isWinner: boolean;
      color: string;
    }[]
  >([]);
  const raceFinishRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raceNextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raceStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const canCreatePrize = useMemo(
    () => newPrizeName.trim().length > 0,
    [newPrizeName]
  );

  const drawTitleId = useMemo(() => {
    return `draw-title-${drawPrizeId ?? "none"}`;
  }, [drawPrizeId]);

  const clearRaceTimers = useCallback(() => {
    if (raceFinishRef.current) {
      clearTimeout(raceFinishRef.current);
      raceFinishRef.current = null;
    }
    if (raceNextRef.current) {
      clearTimeout(raceNextRef.current);
      raceNextRef.current = null;
    }
    if (raceStartRef.current) {
      clearTimeout(raceStartRef.current);
      raceStartRef.current = null;
    }
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const revealAll = useCallback(() => {
    clearRaceTimers();
    setRaceStarted(false);
    setRevealCount(drawWinners.length);
    setDrawPhase("done");
  }, [clearRaceTimers, drawWinners.length]);

  const loadPrizes = useCallback(async () => {
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
  }, [props.eventId]);

  const closeDraw = useCallback(() => {
    clearRaceTimers();
    setDrawOpen(false);
    setDrawPrizeId(null);
    setDrawPrizeName("");
    setDrawPhase("idle");
    setDrawError(null);
    setDrawWinners([]);
    setRevealCount(0);
    setRaceStarted(false);
    setRaceIndex(0);
    setRaceLanes([]);
  }, [clearRaceTimers]);

  function buildRaceLanes(params: {
    prizeId: string;
    winnerLabel: string;
    laneCount: number;
    winnersList: WinnerItem[];
  }) {
    const colors = [
      "bg-red-500",
      "bg-amber-500",
      "bg-emerald-500",
      "bg-sky-500",
      "bg-indigo-500",
      "bg-fuchsia-500",
    ];

    const poolFromCandidates = candidates[params.prizeId] ?? [];
    const pool =
      poolFromCandidates.length > 0
        ? poolFromCandidates
            .map((c) => c.authorName)
            .filter((x): x is string => !!x)
        : params.winnersList
            .map((w) => w.candidate.authorName)
            .filter((x): x is string => !!x);

    const uniq = Array.from(new Set(pool)).filter(
      (x) => x !== params.winnerLabel
    );
    const laneCount = Math.max(3, Math.min(params.laneCount, 6));

    const decoys: string[] = [];
    for (let i = 0; i < laneCount - 1; i += 1) {
      const picked = uniq[Math.floor(Math.random() * uniq.length)];
      decoys.push(picked ?? `참가자 ${i + 1}`);
    }

    const winnerPos = Math.floor(Math.random() * laneCount);
    const lanes: {
      id: string;
      label: string;
      durationMs: number;
      isWinner: boolean;
      color: string;
    }[] = [];

    for (let i = 0; i < laneCount; i += 1) {
      const isWinner = i === winnerPos;
      const label = isWinner
        ? params.winnerLabel
        : decoys.shift() ?? `참가자 ${i + 1}`;
      const durationMs = isWinner
        ? 1200 + Math.floor(Math.random() * 200)
        : 1600 + Math.floor(Math.random() * 1100);

      lanes.push({
        id: `${Date.now()}-${i}-${label}`,
        label,
        durationMs,
        isWinner,
        color: colors[i % colors.length]!,
      });
    }

    return lanes;
  }

  function beginRaceRound(params: {
    prizeId: string;
    roundIndex: number;
    winnersList: WinnerItem[];
  }) {
    if (params.roundIndex >= params.winnersList.length) return;

    clearRaceTimers();

    const winner = params.winnersList[params.roundIndex];
    const winnerLabel = winner?.candidate.authorName || "(이름 없음)";

    setRaceStarted(false);
    setRaceIndex(params.roundIndex);
    const lanes = buildRaceLanes({
      prizeId: params.prizeId,
      winnerLabel,
      laneCount: 6,
      winnersList: params.winnersList,
    });
    setRaceLanes(lanes);
    setDrawPhase("rolling");

    raceStartRef.current = setTimeout(() => {
      setRaceStarted(true);
    }, 40);

    const winnerDuration =
      lanes.find((l) => l.isWinner)?.durationMs ??
      Math.max(...lanes.map((l) => l.durationMs));
    raceFinishRef.current = setTimeout(() => {
      setRaceStarted(false);
      setRevealCount(params.roundIndex + 1);
      setDrawPhase("reveal");

      if (params.roundIndex + 1 >= params.winnersList.length) {
        revealTimerRef.current = setTimeout(() => {
          setDrawPhase("done");
        }, 250);
        return;
      }

      raceNextRef.current = setTimeout(() => {
        beginRaceRound({
          prizeId: params.prizeId,
          roundIndex: params.roundIndex + 1,
          winnersList: params.winnersList,
        });
      }, 650);
    }, winnerDuration + 120);
  }

  async function startDrawGame(prize: PrizeItem) {
    setError(null);
    setDrawError(null);
    setDrawOpen(true);
    setDrawPrizeId(prize.id);
    setDrawPrizeName(prize.name);
    setDrawPhase("loading");
    setDrawWinners([]);
    setRevealCount(0);
    setRaceStarted(false);
    setRaceIndex(0);
    setRaceLanes([]);

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

      if (winnersList.length === 0) {
        setDrawPhase("done");
      } else {
        beginRaceRound({ prizeId: prize.id, roundIndex: 0, winnersList });
      }

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
    setNotice(null);
    setBusyKey(`clearCandidates:${prizeId}`);

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
      const deleted =
        data && "deletedCandidates" in data ? data.deletedCandidates : 0;
      setNotice({
        tone: "success",
        message: `후보를 초기화했습니다. (${deleted}명 삭제)`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeCandidate(prizeId: string, candidateId: string) {
    const ok = window.confirm("이 후보를 제외할까요?");
    if (!ok) return;

    setError(null);
    setNotice(null);
    setBusyKey(`removeCandidate:${candidateId}`);

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
      setNotice({ tone: "success", message: "후보를 제외했습니다." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyKey(null);
    }
  }

  async function moveCandidate(
    fromPrizeId: string,
    candidateId: string,
    toPrizeId: string
  ) {
    if (!toPrizeId) return;

    setError(null);
    setNotice(null);
    setBusyKey(`moveCandidate:${candidateId}`);

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
      setNotice({ tone: "success", message: "후보를 이동했습니다." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyKey(null);
    }
  }

  async function deletePrize(prizeId: string) {
    const ok = window.confirm(
      "이 상품을 삭제할까요? (후보/당첨 결과도 함께 삭제됩니다)"
    );
    if (!ok) return;

    setError(null);
    setNotice(null);
    setBusyKey(`deletePrize:${prizeId}`);

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
      setNotice({ tone: "success", message: "상품을 삭제했습니다." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyKey(null);
    }
  }

  async function createPrize() {
    if (!canCreatePrize) return;

    const label = newPrizeName.trim();
    const qty = newPrizeQty;
    setError(null);
    setNotice(null);
    setBusyKey("createPrize");

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
      setNotice({
        tone: "success",
        message: `${label} (수량 ${qty}) 상품을 추가했습니다.`,
      });
      await loadPrizes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyKey(null);
    }
  }

  async function buildCandidates(prizeId: string) {
    setError(null);
    setNotice(null);
    setBusyKey(`buildCandidates:${prizeId}`);

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

      const created = data && "createdCount" in data ? data.createdCount : 0;
      const total =
        data && "totalCandidates" in data ? data.totalCandidates : 0;
      setNotice({
        tone: "success",
        message: `후보를 생성했습니다. (+${created}, 총 ${total})`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyKey(null);
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
      clearRaceTimers();
    };
  }, [clearRaceTimers]);

  useEffect(() => {
    if (!drawOpen) clearRaceTimers();
  }, [drawOpen, clearRaceTimers]);

  useEffect(() => {
    if (!drawOpen) return;
    closeButtonRef.current?.focus();
  }, [drawOpen]);

  useEffect(() => {
    if (!drawOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeDraw();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawOpen, closeDraw]);

  useEffect(() => {
    void loadPrizes();
  }, [loadPrizes]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-6 py-4">
        <div className="text-sm font-medium text-zinc-900">경품 / 추첨</div>
      </div>

      {error ? (
        <div className="px-6 py-4 text-sm text-red-600">{error}</div>
      ) : null}

      {notice ? (
        <div
          className={`mx-6 mt-4 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 sm:col-span-2"
            placeholder="상품명(예: 에어팟)"
            value={newPrizeName}
            onChange={(e) => setNewPrizeName(e.target.value)}
            disabled={busyKey === "createPrize"}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void createPrize();
            }}
          />
          <input
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400"
            type="number"
            min={1}
            value={newPrizeQty}
            onChange={(e) => {
              const next = Number(e.target.value);
              setNewPrizeQty(Number.isFinite(next) && next > 0 ? next : 1);
            }}
            disabled={busyKey === "createPrize"}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void createPrize();
            }}
          />
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={!canCreatePrize || busyKey === "createPrize"}
            onClick={() => void createPrize()}
          >
            {busyKey === "createPrize" ? "추가 중..." : "상품 추가"}
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
            disabled={loading}
          >
            {loading ? "불러오는 중..." : "새로고침"}
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
                    disabled={drawOpen}
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
                            disabled={busyKey === `buildCandidates:${p.id}`}
                          >
                            {busyKey === `buildCandidates:${p.id}`
                              ? "생성 중..."
                              : "후보 재생성"}
                          </button>
                          <button
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 px-3 text-xs text-red-700 hover:bg-red-50"
                            onClick={() => void clearCandidates(p.id)}
                            disabled={busyKey === `clearCandidates:${p.id}`}
                          >
                            {busyKey === `clearCandidates:${p.id}`
                              ? "초기화 중..."
                              : "후보 초기화"}
                          </button>
                        </>
                      ) : null}

                      <button
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 px-3 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => void deletePrize(p.id)}
                        disabled={busyKey === `deletePrize:${p.id}`}
                      >
                        {busyKey === `deletePrize:${p.id}`
                          ? "삭제 중..."
                          : "상품 삭제"}
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
                                disabled={busyKey === `moveCandidate:${c.id}`}
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
                                disabled={busyKey === `removeCandidate:${c.id}`}
                              >
                                {busyKey === `removeCandidate:${c.id}`
                                  ? "제외 중..."
                                  : "제외"}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            closeDraw();
          }}
        >
          <div
            key={drawPrizeId ?? "draw"}
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawTitleId}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-600">추첨</div>
                <div
                  id={drawTitleId}
                  className="truncate text-sm font-semibold text-zinc-900"
                >
                  {drawPrizeName}
                </div>
              </div>
              <button
                ref={closeButtonRef}
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
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-900">
                      구슬 레이스
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 px-2 text-xs text-zinc-800 hover:bg-zinc-50"
                        onClick={() => revealAll()}
                      >
                        스킵
                      </button>
                      <div className="text-xs text-zinc-600">
                        ROUND {raceIndex + 1}/{Math.max(1, drawWinners.length)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-4">
                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <div>START</div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-0.5 bg-zinc-300" />
                        <div>FINISH</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {raceLanes.map((lane, idx) => (
                        <div
                          key={lane.id}
                          className="relative h-8 rounded-full border border-zinc-200 bg-white"
                        >
                          <div className="absolute right-4 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-zinc-300" />
                          <div
                            className={`absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full ${lane.color} shadow-sm`}
                            style={{
                              left: raceStarted
                                ? "calc(100% - 1.75rem)"
                                : undefined,
                              transitionProperty: "left",
                              transitionDuration: `${lane.durationMs}ms`,
                              transitionTimingFunction:
                                "cubic-bezier(0.22, 1, 0.36, 1)",
                            }}
                            title={lane.label}
                          />
                          <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 truncate text-xs text-zinc-700">
                            {idx + 1}. {lane.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500">
                    먼저 도착한 구슬이 당첨!
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
                          revealAll();
                        }}
                      >
                        스킵
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
                          className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-zinc-600">
                              WIN #{idx + 1}
                            </div>
                            <div className="truncate text-sm font-semibold text-zinc-900">
                              {w.candidate.authorName || "(이름 없음)"}
                            </div>
                            {w.candidate.authorChannelId ? (
                              <div className="truncate text-xs text-zinc-500">
                                {w.candidate.authorChannelId}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-xs font-medium text-zinc-700">
                            당첨
                          </div>
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
