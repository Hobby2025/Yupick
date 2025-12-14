import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { fetchTopLevelComments } from "@/lib/youtube";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
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

    const insertResult = await prisma.comment.createMany({
      data: comments.map((c) => ({
        eventId: id,
        commentId: c.commentId,
        authorName: c.authorName ?? null,
        authorChannelId: c.authorChannelId ?? null,
        text: c.text,
        publishedAt: c.publishedAt ?? null,
      })),
      skipDuplicates: true,
    });

    await prisma.event.update({
      where: { id },
      data: { lastCollectedAt: new Date() },
    });

    return NextResponse.json({
      fetchedCount: comments.length,
      createdCount: insertResult.count,
      updatedCount: 0,
    });
  } catch (e) {
    console.error("POST /api/events/[id]/collect failed", { id }, e);
    const anyErr = e as { message?: string; code?: string };
    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: anyErr.code ?? null,
        message: anyErr.message ?? null,
      },
      { status: 500 }
    );
  }
}
