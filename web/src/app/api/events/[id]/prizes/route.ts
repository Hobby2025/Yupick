import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await ctx.params;

  const prizes = await prisma.prize.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      eventId: true,
      name: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { candidates: true, winners: true } },
    },
  });

  return NextResponse.json({ prizes }, { status: 200 });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    quantity?: number;
  } | null;

  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const quantity =
    typeof body?.quantity === "number" && Number.isFinite(body.quantity)
      ? Math.max(1, Math.floor(body.quantity))
      : 1;

  const prize = await prisma.prize.create({
    data: { eventId, name, quantity },
    select: {
      id: true,
      eventId: true,
      name: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { candidates: true, winners: true } },
    },
  });

  return NextResponse.json({ prize }, { status: 201 });
}
