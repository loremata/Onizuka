import { NextResponse } from "next/server";
import { ApiErrorCode, jsonApiError } from "@/lib/api-json-errors";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAdminApi } from "@/lib/rate-limit";

export async function DELETE(
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
  if (!id) return jsonApiError(400, ApiErrorCode.MISSING_CLIENT_ID, "ID cliente mancante");

  try {
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return jsonApiError(
      500,
      ApiErrorCode.DELETE_CLIENT_FAILED,
      "Eliminazione cliente non riuscita. Potrebbero esserci dati collegati."
    );
  }
}
