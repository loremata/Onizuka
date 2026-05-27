import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { setReferrerPortalSession } from "@/lib/referrer-portal-session";

const TTL_MIN = 30;

export function publicReferBaseUrl(): string {
  return (
    process.env.ONIZUKA_PRIMARY_HOST?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export async function createAndEmailReferrerMagicLink(params: {
  submissionToken: string;
  email: string;
}): Promise<{ ok: true } | { error: string }> {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Email non valida." };

  const referrer = await prisma.referrer.findFirst({
    where: {
      submissionToken: params.submissionToken,
      active: true,
      email: { equals: email, mode: "insensitive" },
    },
    select: { id: true, name: true, email: true },
  });
  if (!referrer) {
    return { ok: true };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

  await prisma.referrerMagicLink.create({
    data: { referrerId: referrer.id, token, expiresAt },
  });

  if (!isSmtpConfigured() || !referrer.email) {
    return { error: "Invio email non configurato. Usa il PIN fornito dall'agenzia." };
  }

  const link = `${publicReferBaseUrl()}/refer?t=${encodeURIComponent(params.submissionToken)}&magic=${token}`;
  await sendEmailViaSmtp({
    to: referrer.email,
    subject: "Accesso portale segnalatore Onizuka",
    text: [
      `Ciao ${referrer.name},`,
      "",
      "Apri questo link per accedere al portale (valido 30 minuti, monouso):",
      link,
      "",
      "Se non hai richiesto l'accesso, ignora questa email.",
    ].join("\n"),
  });

  return { ok: true };
}

export async function consumeReferrerMagicLink(params: {
  submissionToken: string;
  magicToken: string;
}): Promise<{ ok: true } | { error: string }> {
  const magic = params.magicToken.trim();
  if (!magic) return { error: "Link non valido." };

  const row = await prisma.referrerMagicLink.findFirst({
    where: {
      token: magic,
      usedAt: null,
      expiresAt: { gt: new Date() },
      referrer: { submissionToken: params.submissionToken, active: true },
    },
    select: { id: true, referrerId: true },
  });
  if (!row) return { error: "Link scaduto o già utilizzato." };

  await prisma.$transaction([
    prisma.referrerMagicLink.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  await setReferrerPortalSession(row.referrerId);
  return { ok: true };
}
