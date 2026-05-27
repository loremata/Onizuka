import { createHmac, timingSafeEqual } from "crypto";

type OAuthStatePayload = {
  userId: string;
  provider: string;
  ts: number;
};

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET?.trim();
  if (!s) throw new Error("NEXTAUTH_SECRET richiesto per OAuth state.");
  return s;
}

export function signOAuthState(userId: string, provider: string): string {
  const ts = Date.now();
  const body = `${userId}|${provider}|${ts}`;
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return Buffer.from(`${body}|${sig}`).toString("base64url");
}

export function verifyOAuthState(
  state: string,
  maxAgeMs = 10 * 60 * 1000
): OAuthStatePayload | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 4) return null;
    const [userId, provider, tsStr, sig] = parts;
    const body = `${userId}|${provider}|${tsStr}`;
    const expected = createHmac("sha256", secret()).update(body).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return null;
    return { userId, provider, ts };
  } catch {
    return null;
  }
}
