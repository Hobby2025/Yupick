import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { extractVideoId } from "@/lib/youtube";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        videoUrl: true,
        videoId: true,
        lastCollectedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json({ events });
  } catch (e) {
    console.error("GET /api/events failed", e);
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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      videoUrl?: string;
    } | null;

    const videoUrl = body?.videoUrl?.trim();
    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube video url" },
        { status: 400 }
      );
    }

    const event = await prisma.event.create({
      data: {
        name: body?.name?.trim() || null,
        videoUrl,
        videoId,
      },
      select: {
        id: true,
        name: true,
        videoUrl: true,
        videoId: true,
        lastCollectedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    console.error("POST /api/events failed", e);
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
