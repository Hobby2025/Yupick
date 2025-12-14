import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { fetchTopLevelComments } from "@/lib/youtube";
import type { Prisma } from "@prisma/client";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    maxPages?: number;
  } | null;

  const maxPages =
    typeof body?.maxPages === "number" && body.maxPages > 0
      ? Math.min(body.maxPages, 25)
      : 10;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, videoId: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await fetchTopLevelComments({
    videoId: event.videoId,
    apiKey,
    maxPages,
  });

  const results = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const created: string[] = [];
      const updated: string[] = [];

      for (const c of comments) {
        const existing = await tx.comment.findUnique({
          where: { commentId: c.commentId },
          select: { id: true },
        });

        if (existing) {
          await tx.comment.update({
            where: { commentId: c.commentId },
            data: {
              eventId: id,
              authorName: c.authorName ?? null,
              authorChannelId: c.authorChannelId ?? null,
              text: c.text,
              publishedAt: c.publishedAt ?? null,
            },
          });
          updated.push(c.commentId);
        } else {
          await tx.comment.create({
            data: {
              eventId: id,
              commentId: c.commentId,
              authorName: c.authorName ?? null,
              authorChannelId: c.authorChannelId ?? null,
              text: c.text,
              publishedAt: c.publishedAt ?? null,
            },
          });
          created.push(c.commentId);
        }
      }

      await tx.event.update({
        where: { id },
        data: { lastCollectedAt: new Date() },
      });

      return { createdCount: created.length, updatedCount: updated.length };
    }
  );

  return NextResponse.json({
    fetchedCount: comments.length,
    ...results,
  });
}
