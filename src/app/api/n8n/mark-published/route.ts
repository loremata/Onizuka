import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nAuth } from "@/lib/n8n-auth";
import { checkRateLimitN8n } from "@/lib/rate-limit";

function getN8nIdentifier(request: Request): string {
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization") ?? "";
  if (key) return key.slice(0, 32);
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anonymous";
}

type Body = {
  postItemId: string;
  publishedAt?: string; // ISO date
  externalRef?: string;
};

/**
 * POST /api/n8n/mark-published
 * Body: { postItemId, publishedAt?, externalRef? }
 * Auth: X-API-Key or Authorization: Bearer (N8N_API_KEY).
 */
export async function POST(request: Request) {
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

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const postItemId = body.postItemId?.trim();
  if (!postItemId) {
    return NextResponse.json({ error: "postItemId is required" }, { status: 400 });
  }

  const publishedAt = body.publishedAt
    ? new Date(body.publishedAt)
    : new Date();
  if (isNaN(publishedAt.getTime())) {
    return NextResponse.json({ error: "publishedAt must be a valid ISO date" }, { status: 400 });
  }

  const existing = await prisma.postItem.findUnique({
    where: { id: postItemId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await prisma.postItem.update({
    where: { id: postItemId },
    data: {
      publishedAt,
      externalRef: body.externalRef?.trim() ?? existing.externalRef,
    },
  });

  return NextResponse.json({ ok: true });
}
