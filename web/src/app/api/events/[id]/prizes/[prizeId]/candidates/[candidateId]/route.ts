import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; prizeId: string; candidateId: string }> }
) {
  const { id: eventId, prizeId, candidateId } = await ctx.params;

  const prize = await prisma.prize.findFirst({
    where: { id: prizeId, eventId },
    select: { id: true },
  });

  if (!prize) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.prizeCandidate.findFirst({
    where: { id: candidateId, prizeId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.prizeCandidate.delete({ where: { id: candidateId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; prizeId: string; candidateId: string }> }
) {
  const { id: eventId, prizeId, candidateId } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    toPrizeId?: string;
  } | null;

  const toPrizeId = body?.toPrizeId?.trim();
  if (!toPrizeId) {
    return NextResponse.json(
      { error: "toPrizeId is required" },
      { status: 400 }
    );
  }

  if (toPrizeId === prizeId) {
    return NextResponse.json({ ok: true, moved: false }, { status: 200 });
  }

  const fromPrize = await prisma.prize.findFirst({
    where: { id: prizeId, eventId },
    select: { id: true },
  });
  if (!fromPrize) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const toPrize = await prisma.prize.findFirst({
    where: { id: toPrizeId, eventId },
    select: { id: true },
  });
  if (!toPrize) {
    return NextResponse.json(
      { error: "Target prize not found" },
      { status: 404 }
    );
  }

  const candidate = await prisma.prizeCandidate.findFirst({
    where: { id: candidateId, prizeId },
    select: {
      id: true,
      userKey: true,
      authorName: true,
      authorChannelId: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.prizeWinner.deleteMany({ where: { candidateId } });

  const existingInTarget = await prisma.prizeCandidate.findFirst({
    where: { prizeId: toPrizeId, userKey: candidate.userKey },
    select: { id: true },
  });

  if (existingInTarget) {
    await prisma.prizeCandidate.delete({ where: { id: candidateId } });
    return NextResponse.json(
      {
        ok: true,
        moved: true,
        merged: true,
        targetCandidateId: existingInTarget.id,
      },
      { status: 200 }
    );
  }

  await prisma.prizeCandidate.update({
    where: { id: candidateId },
    data: { prizeId: toPrizeId },
  });

  return NextResponse.json(
    { ok: true, moved: true, merged: false },
    { status: 200 }
  );
}
