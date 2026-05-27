import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "onizuka_client_preview";
const MAX_AGE_SEC = 2 * 60 * 60;

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? "dev-client-preview-secret";
}

function sign(adminUserId: string, clientId: string, expMs: number): string {
  const body = `${adminUserId}:${clientId}:${expMs}`;
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return `${body}:${sig}`;
}

export type ClientPreviewContext = {
  adminUserId: string;
  clientId: string;
};

function parse(value: string): ClientPreviewContext | null {
  const parts = value.split(":");
  if (parts.length !== 4) return null;
  const adminUserId = parts[0]!;
  const clientId = parts[1]!;
  const expMs = Number(parts[2]);
  const sig = parts[3]!;
  if (!adminUserId || !clientId || !Number.isFinite(expMs) || expMs < Date.now()) return null;
  const expected = createHmac("sha256", secret()).update(`${adminUserId}:${clientId}:${expMs}`).digest("hex");
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
  return { adminUserId, clientId };
}

export async function setClientPreviewCookie(adminUserId: string, clientId: string): Promise<void> {
  const expMs = Date.now() + MAX_AGE_SEC * 1000;
  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(adminUserId, clientId, expMs), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearClientPreviewCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getClientPreviewContext(): Promise<ClientPreviewContext | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return parse(raw);
}

/** Legge cookie da Request (middleware). */
export function getClientPreviewFromRequest(req: Request): ClientPreviewContext | null {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) return null;
  try {
    return parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
