import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import type { UserNotificationRow } from "@/lib/user-notifications";

export function digestEmailEnabled(): boolean {
  if (process.env.NOTIFY_DIGEST_EMAIL === "0") return false;
  return isSmtpConfigured();
}

export function buildNotificationDigestText(
  items: Pick<UserNotificationRow, "title" | "body" | "href" | "createdAt">[],
  baseUrl: string
): string {
  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });
  const lines = items.map((n, i) => {
    const when = dateFmt.format(n.createdAt);
    const link = n.href ? `${baseUrl}${n.href}` : baseUrl;
    return `${i + 1}. [${when}] ${n.title}${n.body ? `\n   ${n.body}` : ""}\n   ${link}`;
  });

  return [
    "Ciao,",
    "",
    `Hai ${items.length} notifica/e non letta/e su Onizuka:`,
    "",
    ...lines,
    "",
    `Apri il centro notifiche: ${baseUrl}/app/notifications`,
    "",
    "— Onizuka",
  ].join("\n");
}

export async function sendUserNotificationDigest(
  userId: string
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  if (!digestEmailEnabled()) {
    return { ok: false, error: "Digest email disabilitato o SMTP non configurato (NOTIFY_DIGEST_EMAIL)." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, notifyDigestEmail: true },
  });
  if (!user?.email) return { ok: false, error: "Email utente non disponibile." };
  if (user.notifyDigestEmail === false) {
    return { ok: false, error: "Digest email disabilitato nelle impostazioni utente." };
  }

  const unread = await prisma.userNotification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { title: true, body: true, href: true, createdAt: true },
  });

  if (unread.length === 0) return { ok: false, error: "Nessuna notifica non letta." };

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const notificationsPath = user.role === "ADMIN" ? "/admin/notifications" : "/app/notifications";
  const text = buildNotificationDigestText(unread, baseUrl).replace(
    `${baseUrl}/app/notifications`,
    `${baseUrl}${notificationsPath}`
  );

  const sent = await sendEmailViaSmtp({
    to: user.email,
    subject: `[Onizuka] Riepilogo notifiche (${unread.length})`,
    text,
  });

  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true, sent: unread.length };
}

export async function sendDigestToUsersWithUnread(
  userIds: string[]
): Promise<{ attempted: number; sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;
  for (const userId of userIds) {
    const result = await sendUserNotificationDigest(userId);
    if (result.ok) sent += 1;
    else errors += 1;
  }
  return { attempted: userIds.length, sent, errors };
}
