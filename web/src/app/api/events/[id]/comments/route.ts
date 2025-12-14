import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const format = (
    req.nextUrl.searchParams.get("format") ?? "json"
  ).toLowerCase();

  const where = q
    ? {
        eventId: id,
        OR: [
          { text: { contains: q, mode: "insensitive" as const } },
          { authorName: { contains: q, mode: "insensitive" as const } },
          { authorChannelId: { contains: q, mode: "insensitive" as const } },
          { commentId: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { eventId: id };

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      commentId: true,
      authorName: true,
      authorChannelId: true,
      text: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  if (format === "csv") {
    const seen = new Set<string>();
    const users: Array<{ authorName: string; authorChannelId: string }> = [];

    for (const c of comments) {
      const authorName = c.authorName ?? "";
      const authorChannelId = c.authorChannelId ?? "";
      if (!authorName && !authorChannelId) continue;

      const key = `${authorName}::${authorChannelId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      users.push({ authorName, authorChannelId });
    }

    const header = ["authorName", "authorChannelId"].join(",");

    const rows = users
      .map((u) => {
        return [csvEscape(u.authorName), csvEscape(u.authorChannelId)].join(
          ","
        );
      })
      .join("\n");

    const bom = "\ufeff";
    const csv = `${bom}${header}\n${rows}\n`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="event-${id}-users.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.json({ comments }, { status: 200 });
}
