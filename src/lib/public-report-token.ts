import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_DAYS = 30;

export function generatePublicReportToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function ensureDigitalAuditPublicReportToken(
  auditId: string,
  ownerUserId: string,
  opts?: { ttlDays?: number; rotate?: boolean }
): Promise<{ token: string; expiresAt: Date | null }> {
  const audit = await prisma.digitalAudit.findFirst({
    where: { id: auditId, ownerUserId },
    select: { publicReportToken: true, publicReportExpiresAt: true },
  });
  if (!audit) throw new Error("Audit non trovato.");

  const now = new Date();
  if (
    !opts?.rotate &&
    audit.publicReportToken &&
    (!audit.publicReportExpiresAt || audit.publicReportExpiresAt > now)
  ) {
    return { token: audit.publicReportToken, expiresAt: audit.publicReportExpiresAt };
  }

  const ttl = opts?.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = ttl > 0 ? new Date(now.getTime() + ttl * 86400000) : null;
  const token = generatePublicReportToken();

  await prisma.digitalAudit.update({
    where: { id: auditId },
    data: { publicReportToken: token, publicReportExpiresAt: expiresAt },
  });

  return { token, expiresAt };
}

export function publicReportPath(token: string): string {
  return `/report/${token}`;
}
