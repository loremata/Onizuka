import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import {
  deleteAdminPushSubscription,
  saveAdminPushSubscription,
} from "@/lib/admin-web-push";

/** Iscrive questo dispositivo alle notifiche push dell'admin. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const keys = body.keys as { p256dh?: string; auth?: string } | undefined;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Subscription non valida." }, { status: 400 });
  }

  await saveAdminPushSubscription({
    userId: session.user.id,
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

/** Disiscrive il dispositivo (l'utente ha spento le notifiche da Onizuka). */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint mancante." }, { status: 400 });
  }

  await deleteAdminPushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
