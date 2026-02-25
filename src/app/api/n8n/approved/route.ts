import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nAuth } from "@/lib/n8n-auth";
import { checkRateLimitN8n } from "@/lib/rate-limit";

const BASE_URL = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${BASE_URL.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * GET /api/n8n/approved?clientSlug=...&platform=...
 * Returns approved posts for the client (by slug) with media URLs and caption.
 * Auth: X-API-Key or Authorization: Bearer (N8N_API_KEY).
 */
function getN8nIdentifier(request: Request): string {
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization") ?? "";
  if (key) return key.slice(0, 32);
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anonymous";
}

export async function GET(request: Request) {
  const auth = requireN8nAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "N8N_API_KEY not configured" },
      { status: auth.status }
    );
  }

  const rl = checkRateLimitN8n(getN8nIdentifier(request));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const clientSlug = searchParams.get("clientSlug")?.trim();
  const platform = searchParams.get("platform")?.trim();

  if (!clientSlug) {
    return NextResponse.json(
      { error: "clientSlug is required" },
      { status: 400 }
    );
  }

  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 }
    );
  }

  const posts = await prisma.postItem.findMany({
    where: {
      clientId: client.id,
      status: "APPROVED",
      ...(platform ? { platform: platform as "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "GBP" } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { media: true },
  });

  const items = posts.map((p) => ({
    postItemId: p.id,
    clientId: p.clientId,
    clientSlug: client.slug,
    platform: p.platform,
    captionText: p.captionText,
    mediaUrls: p.media.map((m) => toAbsoluteUrl(m.url)),
    scheduledFor: p.scheduledFor?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    externalRef: p.externalRef,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ items });
}
