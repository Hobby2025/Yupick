import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export async function DELETE(
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

  await prisma.prize.delete({ where: { id: prizeId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
