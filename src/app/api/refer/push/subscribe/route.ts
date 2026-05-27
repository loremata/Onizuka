import { NextResponse } from "next/server";
import { getReferrerIdFromPortalSession } from "@/lib/referrer-portal-session";
import { saveReferrerPushSubscription } from "@/lib/referrer-web-push";

export async function POST(request: Request) {
  const referrerId = await getReferrerIdFromPortalSession();
  if (!referrerId) {
    return NextResponse.json({ error: "Sessione portale richiesta." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const keys = body.keys as { p256dh?: string; auth?: string } | undefined;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Subscription non valida." }, { status: 400 });
  }

  await saveReferrerPushSubscription({
    referrerId,
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}
