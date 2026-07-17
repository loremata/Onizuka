import type { OAuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptJson, encryptJson } from "@/lib/token-crypto";
import type { GoogleTokenBundle } from "@/lib/google-calendar-oauth";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const PROVIDER: OAuthProvider = "GOOGLE_ANALYTICS";

function clientConfig() {
  const clientId =
    process.env.GOOGLE_ANALYTICS_CLIENT_ID?.trim() ??
    process.env.GOOGLE_GBP_CLIENT_ID?.trim() ??
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret =
    process.env.GOOGLE_ANALYTICS_CLIENT_SECRET?.trim() ??
    process.env.GOOGLE_GBP_CLIENT_SECRET?.trim() ??
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_ANALYTICS_REDIRECT_URI?.trim() ??
    `${process.env.NEXTAUTH_URL?.replace(/\/$/, "")}/api/integrations/ga4/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGa4OAuthConfigured(): boolean {
  return clientConfig() !== null;
}

export function buildGa4AuthUrl(state: string): string | null {
  const cfg = clientConfig();
  if (!cfg) return null;
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeGa4Code(code: string): Promise<GoogleTokenBundle> {
  const cfg = clientConfig();
  if (!cfg) throw new Error("GA4 OAuth non configurato.");
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as GoogleTokenBundle & { error?: string; expires_in?: number };
  if (!res.ok || !json.refresh_token) throw new Error(json.error ?? "Token exchange fallito");
  return {
    ...json,
    expiry_date: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
  };
}

export async function saveGa4Tokens(userId: string, tokens: GoogleTokenBundle): Promise<void> {
  const cipher = encryptJson(tokens);
  await prisma.userOAuthConnection.upsert({
    where: { userId_provider: { userId, provider: PROVIDER } },
    create: { userId, provider: PROVIDER, tokenCipher: cipher },
    update: { tokenCipher: cipher },
  });
}

export async function isGa4Connected(userId: string): Promise<boolean> {
  const row = await prisma.userOAuthConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function loadGa4AccessToken(userId: string): Promise<string | null> {
  const row = await prisma.userOAuthConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });
  if (!row) return null;

  const bundle = decryptJson<GoogleTokenBundle>(row.tokenCipher);
  if (bundle.access_token && bundle.expiry_date && bundle.expiry_date > Date.now() + 60_000) {
    return bundle.access_token;
  }

  const cfg = clientConfig();
  if (!cfg || !bundle.refresh_token) return bundle.access_token ?? null;

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: bundle.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) return null;

  await saveGa4Tokens(userId, {
    ...bundle,
    access_token: json.access_token,
    expiry_date: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}
