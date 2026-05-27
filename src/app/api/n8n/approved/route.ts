import { NextResponse } from "next/server";
import { ApiErrorCode, jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { requireN8nAuth } from "@/lib/n8n-auth";
import {
  checkRateLimitN8n,
  checkRateLimitN8nIngress,
  getRequestIp,
} from "@/lib/rate-limit";

function publicBaseUrl(): string {
  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

const BASE_URL = publicBaseUrl();

function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${BASE_URL.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * GET /api/n8n/approved?clientSlug=...&platform=...
 * Returns approved posts for the client (by slug) with media URLs and caption.
 * Auth: X-API-Key or Authorization: Bearer (N8N_API_KEY).
 */
export async function GET(request: Request) {
  const ingress = await checkRateLimitN8nIngress(getRequestIp(request));
  if (!ingress.ok) {
    return jsonApiError(
      429,
      ApiErrorCode.RATE_LIMIT,
      "Troppe richieste",
      { "Retry-After": String(ingress.retryAfter) }
    );
  }

  const auth = requireN8nAuth(request);
  if (!auth.ok) {
    if (auth.status === 401) {
      return jsonApiError(401, ApiErrorCode.UNAUTHORIZED, "Non autorizzato");
    }
    return jsonApiError(
      503,
      ApiErrorCode.N8N_KEY_NOT_CONFIGURED,
      "Variabile N8N_API_KEY non configurata sul server"
    );
  }

  const rl = await checkRateLimitN8n(request);
  if (!rl.ok) {
    return jsonApiError(429, ApiErrorCode.RATE_LIMIT, "Troppe richieste", {
      "Retry-After": String(rl.retryAfter),
    });
  }

  const { searchParams } = new URL(request.url);
  const clientSlug = searchParams.get("clientSlug")?.trim();
  const platform = searchParams.get("platform")?.trim();

  if (!clientSlug) {
    return jsonApiError(
      400,
      ApiErrorCode.MISSING_CLIENT_SLUG,
      "Parametro clientSlug obbligatorio"
    );
  }

  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
  });

  if (!client) {
    return jsonApiError(404, ApiErrorCode.CLIENT_NOT_FOUND, "Cliente non trovato");
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
