import { prisma } from "@/lib/prisma";

/**
 * Web Push per gli utenti admin. Gemello di `referrer-web-push.ts`: stesse
 * chiavi VAPID, stesso comportamento fail-safe (senza configurazione e' un
 * no-op silenzioso, non un errore).
 *
 * Serve a una cosa sola: sapere in dieci secondi che e' entrato un contatto,
 * ovunque tu sia. Per questo la notifica porta a /admin/m/lead, che e' fatta
 * per il pollice, e non alla tabella desktop.
 */
export function isAdminWebPushConfigured(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim() &&
    process.env.VAPID_SUBJECT?.trim()
  );
}

export async function saveAdminPushSubscription(params: {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}): Promise<void> {
  await prisma.adminPushSubscription.upsert({
    where: { endpoint: params.endpoint },
    create: {
      userId: params.userId,
      endpoint: params.endpoint,
      p256dh: params.keys.p256dh,
      auth: params.keys.auth,
      userAgent: params.userAgent ?? null,
    },
    update: {
      // Lo stesso endpoint puo' cambiare proprietario se sul dispositivo si
      // accede con un altro utente: l'ultimo iscritto vince.
      userId: params.userId,
      p256dh: params.keys.p256dh,
      auth: params.keys.auth,
      userAgent: params.userAgent ?? null,
    },
  });
}

export async function deleteAdminPushSubscription(endpoint: string): Promise<void> {
  await prisma.adminPushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Invia a TUTTI i dispositivi iscritti degli admin. Best-effort: ogni errore e'
 * silenziato e le iscrizioni morte (410 Gone quando l'utente disinstalla o
 * revoca) vengono ripulite, altrimenti la tabella si riempie di endpoint scaduti.
 */
export async function notifyAdminsViaWebPush(params: {
  title: string;
  body: string;
  /** Percorso da aprire al tocco sulla notifica. */
  url?: string;
}): Promise<void> {
  if (!isAdminWebPushConfigured()) return;

  // Stesso pubblico di notifyAdminUsers: solo ADMIN pieni. Senza questo filtro
  // uno STAFF escluso dal modulo CRM potrebbe iscriversi e ricevere via push i
  // nomi dei lead che dal desktop non vedrebbe.
  const subs = await prisma.adminPushSubscription.findMany({
    where: { user: { role: "ADMIN" } },
    take: 50,
  });
  if (subs.length === 0) return;

  try {
    const webpush = await import("web-push");
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!.trim(),
      process.env.VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim()
    );

    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      url: params.url ?? "/admin/m/lead",
    });

    await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
          .catch(async (err: unknown) => {
            const status = (err as { statusCode?: number } | null)?.statusCode;
            // 404/410 = iscrizione morta. Gli altri errori possono essere
            // temporanei (rete, rate limit): quelli non li cancello.
            if (status === 404 || status === 410) {
              await prisma.adminPushSubscription
                .delete({ where: { id: s.id } })
                .catch(() => {});
            }
          })
      )
    );
  } catch {
    /* web-push assente o VAPID malformata: niente push, nessun errore a monte. */
  }
}
