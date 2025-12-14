import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; prizeId: string }> }
) {
  const { id: eventId, prizeId } = await ctx.params;

  const prize = await prisma.prize.findFirst({
    where: { id: prizeId, eventId },
    select: { id: true },
  });

  if (!prize) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const winners = await prisma.prizeWinner.findMany({
    where: { prizeId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      candidate: {
        select: {
          id: true,
          userKey: true,
          authorName: true,
          authorChannelId: true,
        },
      },
    },
  });

  return NextResponse.json({ winners }, { status: 200 });
}

// 추첨: 후보에서 랜덤으로 count명 뽑아서 PrizeWinner에 저장
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; prizeId: string }> }
) {
  const { id: eventId, prizeId } = await ctx.params;

  const prize = await prisma.prize.findFirst({
    where: { id: prizeId, eventId },
    select: { id: true, quantity: true },
  });

  if (!prize) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    count?: number;
  } | null;

  const alreadyWinners = await prisma.prizeWinner.findMany({
    where: { prizeId },
    select: { candidateId: true },
  });
  const winnerCandidateIds = new Set(alreadyWinners.map((w) => w.candidateId));

  const remainingSlots = Math.max(0, prize.quantity - winnerCandidateIds.size);

  const requested =
    typeof body?.count === "number" && Number.isFinite(body.count)
      ? Math.max(1, Math.floor(body.count))
      : remainingSlots;

  const drawCount = Math.min(requested, remainingSlots);

  if (drawCount <= 0) {
    return NextResponse.json(
      { drawnCount: 0, message: "No remaining slots" },
      { status: 200 }
    );
  }

  const candidates = await prisma.prizeCandidate.findMany({
    where: { prizeId },
    select: {
      id: true,
      userKey: true,
      authorName: true,
      authorChannelId: true,
    },
  });

  const available = candidates.filter((c) => !winnerCandidateIds.has(c.id));
  shuffleInPlace(available);

  const picked = available.slice(0, drawCount);

  const inserted =
    picked.length > 0
      ? await prisma.prizeWinner.createMany({
          data: picked.map((p) => ({ prizeId, candidateId: p.id })),
          skipDuplicates: true,
        })
      : { count: 0 };

  const winners = await prisma.prizeWinner.findMany({
    where: { prizeId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      candidate: {
        select: {
          id: true,
          userKey: true,
          authorName: true,
          authorChannelId: true,
        },
      },
    },
  });

  return NextResponse.json(
    { drawnCount: inserted.count, winners },
    { status: 200 }
  );
}
