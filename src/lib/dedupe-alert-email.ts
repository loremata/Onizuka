import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { prisma } from "@/lib/prisma";

const DEFAULT_THRESHOLD = 1;

export async function maybeSendDedupeScanAlertEmail(
  ownerUserId: string,
  runId: string,
  groupCount: number
): Promise<void> {
  if (process.env.DEDUPE_ALERT_EMAIL_CRON === "0") return;
  if (!isSmtpConfigured()) return;

  const run = await prisma.dedupeScanRun.findFirst({
    where: { id: runId, ownerUserId, alertEmailSentAt: null },
  });
  if (!run) return;

  const user = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { email: true, notifyDigestEmail: true, dedupeAlertMinGroups: true },
  });

  const threshold =
    user?.dedupeAlertMinGroups != null && user.dedupeAlertMinGroups >= 1
      ? user.dedupeAlertMinGroups
      : Number(process.env.DEDUPE_ALERT_MIN_GROUPS ?? String(DEFAULT_THRESHOLD));
  if (!Number.isFinite(groupCount) || groupCount < threshold) return;
  if (!user?.email || !user.notifyDigestEmail) return;

  let summaryLines: string[] = [];
  if (run.summaryJson) {
    try {
      const parsed = JSON.parse(run.summaryJson) as {
        groups?: { reason: string; count: number; names: string[] }[];
      };
      summaryLines = (parsed.groups ?? [])
        .slice(0, 12)
        .map((g) => `· [${g.reason}] ${g.count} clienti — ${g.names.join(", ")}`);
    } catch {
      summaryLines = [];
    }
  }

  const text = [
    "Onizuka — Scansione dedupe completata",
    "",
    `Gruppi duplicati rilevati: ${groupCount}`,
    `Indicizzazione fuzzy: ${run.fuzzyIndexedClients} anagrafiche`,
    "",
    ...summaryLines,
    "",
    "Apri /admin/crm/dedupe per unire i duplicati.",
  ].join("\n");

  await sendEmailViaSmtp({
    to: user.email,
    subject: `[Onizuka] ${groupCount} gruppi duplicati anagrafica`,
    text,
  });

  await prisma.dedupeScanRun.update({
    where: { id: runId },
    data: { alertEmailSentAt: new Date() },
  });
}
