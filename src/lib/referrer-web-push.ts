import { prisma } from "@/lib/prisma";

export function isReferrerWebPushConfigured(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim() &&
    process.env.VAPID_SUBJECT?.trim()
  );
}

export async function saveReferrerPushSubscription(params: {
  referrerId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  await prisma.referrerPushSubscription.upsert({
    where: { endpoint: params.endpoint },
    create: {
      referrerId: params.referrerId,
      endpoint: params.endpoint,
      p256dh: params.keys.p256dh,
      auth: params.keys.auth,
    },
    update: {
      referrerId: params.referrerId,
      p256dh: params.keys.p256dh,
      auth: params.keys.auth,
    },
  });
}

/** Invia notifica push ai subscriber del segnalatore (best-effort, richiede web-push opzionale). */
export async function notifyReferrerPush(params: {
  referrerId: string;
  title: string;
  body: string;
}): Promise<void> {
  if (!isReferrerWebPushConfigured()) return;

  const subs = await prisma.referrerPushSubscription.findMany({
    where: { referrerId: params.referrerId },
    take: 20,
  });
  if (subs.length === 0) return;

  try {
    const webpush = await import("web-push");
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!.trim(),
      process.env.VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim()
    );
    const payload = JSON.stringify({ title: params.title, body: params.body });
    await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payload
          )
          .catch(async () => {
            await prisma.referrerPushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          })
      )
    );
  } catch {
    /* web-push non installato o VAPID errato */
  }
}
