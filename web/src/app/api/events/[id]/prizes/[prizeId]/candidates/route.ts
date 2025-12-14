import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

function makeUserKey(
  authorName: string | null,
  authorChannelId: string | null
) {
  const ch = (authorChannelId ?? "").trim();
  if (ch) return `ch:${ch}`;
  const nm = (authorName ?? "").trim();
  if (nm) return `name:${nm}`;
  return "";
}

export async function GET(
  req: NextRequest,
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

  const candidates = await prisma.prizeCandidate.findMany({
    where: { prizeId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userKey: true,
      authorName: true,
      authorChannelId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ candidates }, { status: 200 });
}

// 후보 리스트 생성(댓글 -> 유저 중복 제거) + DB에 고정 저장
export async function POST(
  req: NextRequest,
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

  const body = (await req.json().catch(() => null)) as {
    q?: string;
  } | null;

  const q = (body?.q ?? "").trim();

  const where = q
    ? {
        eventId,
        OR: [
          { text: { contains: q, mode: "insensitive" as const } },
          { authorName: { contains: q, mode: "insensitive" as const } },
          { authorChannelId: { contains: q, mode: "insensitive" as const } },
          { commentId: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { eventId };

  const commenters = await prisma.comment.findMany({
    where,
    select: {
      authorName: true,
      authorChannelId: true,
    },
  });

  const seen = new Set<string>();
  const data: Array<{
    prizeId: string;
    userKey: string;
    authorName: string | null;
    authorChannelId: string | null;
  }> = [];

  for (const u of commenters) {
    const userKey = makeUserKey(u.authorName, u.authorChannelId);
    if (!userKey) continue;
    if (seen.has(userKey)) continue;
    seen.add(userKey);
    data.push({
      prizeId,
      userKey,
      authorName: u.authorName ?? null,
      authorChannelId: u.authorChannelId ?? null,
    });
  }

  const insert =
    data.length > 0
      ? await prisma.prizeCandidate.createMany({ data, skipDuplicates: true })
      : { count: 0 };

  const total = await prisma.prizeCandidate.count({ where: { prizeId } });

  return NextResponse.json(
    { createdCount: insert.count, totalCandidates: total },
    { status: 200 }
  );
}
