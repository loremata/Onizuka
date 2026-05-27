import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ApiErrorCode, jsonApiError } from "@/lib/api-json-errors";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAdminApi } from "@/lib/rate-limit";

export async function POST(
  req: Request,
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

  const next = !sub.isActive;
  await prisma.webhookSubscription.update({
    where: { id },
    data: { isActive: next },
  });

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "webhook.toggle",
    entityType: "webhook",
    entityId: id,
    summary: `Webhook ${sub.event} ${next ? "attivato" : "disattivato"}`,
  });

  revalidatePath("/admin/webhooks");
  revalidatePath("/admin/audit");

  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/admin/webhooks`);
}
