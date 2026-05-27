import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { ApiErrorCode, jsonApiError } from "@/lib/api-json-errors";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAdminApi } from "@/lib/rate-limit";
import { deliverWebhookPing } from "@/lib/webhook-deliver";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return jsonApiError(401, ApiErrorCode.UNAUTHORIZED, "Non autorizzato");
  }

  const rl = await checkRateLimitAdminApi(session.user.id);
  if (!rl.ok) {
    return jsonApiError(429, ApiErrorCode.RATE_LIMIT, "Troppe richieste", {
      "Retry-After": String(rl.retryAfter),
    });
  }

  const { id } = await params;
  const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!sub) return jsonApiError(404, ApiErrorCode.WEBHOOK_NOT_FOUND, "Non trovato");

  const result = await deliverWebhookPing(sub.id, sub.targetUrl, sub.secret);

  void logAuditEvent({
    actorUserId: session.user.id,
    action: result.ok ? "webhook.test_ok" : "webhook.test_failed",
    entityType: "webhook",
    entityId: sub.id,
    summary: result.ok
      ? `Test webhook OK (${result.status}): ${sub.targetUrl}`
      : `Test webhook fallito (${result.status}): ${sub.targetUrl}`,
    metadata: { status: result.status, detail: result.ok ? undefined : result.detail },
  });

  revalidatePath("/admin/webhooks");
  revalidatePath("/admin/audit");

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, status: result.status, error: result.detail || "Errore di consegna" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, status: result.status });
}
