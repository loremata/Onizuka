import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "onizuka_referrer_portal";
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? process.env.REFERRER_PORTAL_SECRET ?? "dev-referrer-portal-secret";
}

function signPayload(referrerId: string, expMs: number): string {
  const body = `${referrerId}:${expMs}`;
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return `${body}:${sig}`;
}

function parseSigned(value: string): { referrerId: string } | null {
  const parts = value.split(":");
  if (parts.length !== 3) return null;
  const referrerId = parts[0]!;
  const expMs = Number(parts[1]);
  const sig = parts[2]!;
  if (!referrerId || !Number.isFinite(expMs) || expMs < Date.now()) return null;
  const expected = createHmac("sha256", secret()).update(`${referrerId}:${expMs}`).digest("hex");
  try {
    if (
      expected.length !== sig.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return { referrerId };
}

export async function setReferrerPortalSession(referrerId: string): Promise<void> {
  const expMs = Date.now() + MAX_AGE_SEC * 1000;
  const jar = await cookies();
  jar.set(COOKIE_NAME, signPayload(referrerId, expMs), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearReferrerPortalSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getReferrerIdFromPortalSession(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return parseSigned(raw)?.referrerId ?? null;
}
