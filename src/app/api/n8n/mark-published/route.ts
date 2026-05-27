import { NextResponse } from "next/server";
import { ApiErrorCode, jsonApiError } from "@/lib/api-json-errors";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";
import { requireN8nAuth } from "@/lib/n8n-auth";
import { notifyClientUsers } from "@/lib/user-notifications";
import {
  checkRateLimitN8n,
  checkRateLimitN8nIngress,
  getRequestIp,
} from "@/lib/rate-limit";

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

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, ApiErrorCode.INVALID_JSON, "JSON non valido");
  }

  const postItemId = body.postItemId?.trim();
  if (!postItemId) {
    return jsonApiError(
      400,
      ApiErrorCode.MISSING_POST_ITEM_ID,
      "Campo postItemId obbligatorio"
    );
  }

  const publishedAt = body.publishedAt
    ? new Date(body.publishedAt)
    : new Date();
  if (isNaN(publishedAt.getTime())) {
    return jsonApiError(
      400,
      ApiErrorCode.INVALID_PUBLISHED_AT,
      "publishedAt deve essere una data ISO valida"
    );
  }

  const existing = await prisma.postItem.findUnique({
    where: { id: postItemId },
    include: { client: { select: { companyName: true } } },
  });

  if (!existing) {
    return jsonApiError(404, ApiErrorCode.POST_NOT_FOUND, "Post non trovato");
  }

  await prisma.postItem.update({
    where: { id: postItemId },
    data: {
      publishedAt,
      externalRef: body.externalRef?.trim() ?? existing.externalRef,
    },
  });

  void logAuditEvent({
    action: "post.published",
    entityType: "post",
    entityId: postItemId,
    summary: `Post pubblicato su ${existing.platform}${existing.client ? ` · ${existing.client.companyName}` : ""}`,
    metadata: { publishedAt: publishedAt.toISOString(), externalRef: body.externalRef },
  });

  void notifyClientUsers({
    clientId: existing.clientId,
    kind: "post_published",
    title: `Contenuto pubblicato · ${existing.platform}`,
    body: existing.captionText.slice(0, 120) || undefined,
    href: `/app/posts/${postItemId}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
