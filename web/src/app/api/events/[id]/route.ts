import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      videoUrl: true,
      videoId: true,
      lastCollectedAt: true,
      createdAt: true,
      updatedAt: true,
      comments: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          commentId: true,
          authorName: true,
          authorChannelId: true,
          text: true,
          publishedAt: true,
          createdAt: true,
        },
      },
      _count: { select: { comments: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
}
