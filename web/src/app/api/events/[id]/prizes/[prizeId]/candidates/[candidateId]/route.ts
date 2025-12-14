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
