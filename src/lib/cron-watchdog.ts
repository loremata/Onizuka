import { prisma } from "@/lib/prisma";
import { loadCronHealth, cronProblemLine } from "@/lib/cron-health";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";

/**
 * SVEGLIA. Controlla il battito e avvisa su Telegram quando un lavoro notturno
 * tace, fallisce o resta appeso.
 *
 * Gira dentro un cron FREQUENTE (webhook-retry, ogni 15 min) e non dentro
 * quello giornaliero: se la sveglia stesse nel job delle 6:00, un guasto di
 * quel job spegnerebbe anche la sveglia. Resta il caso limite "Vercel non
 * esegue piu' nessun cron", che nessun controllo interno puo' rilevare per
 * definizione — per quello serve un ping esterno su /api/health/ready.
 *
 * Anti-spam: un avviso per cron ogni ANTISPAM_HOURS, tracciato sulle notifiche
 * gia' esistenti (nessuna tabella in piu').
 */

const ANTISPAM_HOURS = 12;
const KIND = "cron_stale";

export type WatchdogResult = { checked: number; problems: number; alerted: number };

export async function runCronWatchdog(now = new Date()): Promise<WatchdogResult> {
  const health = await loadCronHealth(now);
  const result: WatchdogResult = { checked: health.rows.length, problems: health.problems.length, alerted: 0 };
  if (!health.problems.length) return result;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!admins.length) return result;

  const since = new Date(now.getTime() - ANTISPAM_HOURS * 3_600_000);
  const alreadyAlerted = await prisma.userNotification.findMany({
    where: { kind: KIND, createdAt: { gte: since } },
    select: { title: true },
  });
  const alertedTitles = new Set(alreadyAlerted.map((n) => n.title));

  const fresh = health.problems.filter((p) => !alertedTitles.has(`Lavoro notturno fermo: ${p.label}`));
  if (!fresh.length) return result;

  for (const p of fresh) {
    const title = `Lavoro notturno fermo: ${p.label}`;
    await prisma.userNotification
      .createMany({
        data: admins.map((a) => ({
          userId: a.id,
          kind: KIND,
          title,
          body: cronProblemLine(p),
          href: "/admin/settings",
        })),
      })
      .catch(() => undefined);
    result.alerted += 1;
  }

  const lines = fresh.map((p) => `• ${cronProblemLine(p)}`).join("\n");
  await notifyAdminsViaTelegram(
    `⏰ *Lavori notturni: qualcosa non gira*\n\n${lines}\n\nDettaglio: /admin/settings`
  ).catch(() => undefined);

  return result;
}
