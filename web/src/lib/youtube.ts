export type YouTubeComment = {
  commentId: string;
  authorName?: string;
  authorChannelId?: string;
  text: string;
  publishedAt?: Date;
};

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed) && !trimmed.includes("http")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace(/^\//, "");
      return id || null;
    }

    if (url.hostname.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;

      const match = url.pathname.match(/\/shorts\/([^/?#]+)/);
      if (match?.[1]) return match[1];

      const embedMatch = url.pathname.match(/\/embed\/([^/?#]+)/);
      if (embedMatch?.[1]) return embedMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

type CommentThreadsResponse = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      topLevelComment?: {
        id?: string;
        snippet?: {
          authorDisplayName?: string;
          authorChannelId?: { value?: string };
          textDisplay?: string;
          textOriginal?: string;
          publishedAt?: string;
        };
      };
    };
  }>;
};

export async function fetchTopLevelComments(params: {
  videoId: string;
  apiKey: string;
  maxPages?: number;
}): Promise<YouTubeComment[]> {
  const { videoId, apiKey, maxPages = 10 } = params;

  const comments: YouTubeComment[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("videoId", videoId);
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("textFormat", "plainText");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `YouTube API error: ${res.status} ${res.statusText} ${body}`
      );
    }

    const data = (await res.json()) as CommentThreadsResponse;

    for (const item of data.items ?? []) {
      const top = item.snippet?.topLevelComment;
      const commentId = top?.id;
      const s = top?.snippet;
      if (!commentId || !s) continue;

      const text = s.textOriginal ?? s.textDisplay;
      if (!text) continue;

      comments.push({
        commentId,
        authorName: s.authorDisplayName,
        authorChannelId: s.authorChannelId?.value,
        text,
        publishedAt: s.publishedAt ? new Date(s.publishedAt) : undefined,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return comments;
}
