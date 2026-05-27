import type { OAuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptJson, encryptJson } from "@/lib/token-crypto";
import type { GoogleTokenBundle } from "@/lib/google-calendar-oauth";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");
const PROVIDER: OAuthProvider = "GMAIL";

function clientConfig() {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI?.trim() ??
    `${process.env.NEXTAUTH_URL?.replace(/\/$/, "")}/api/integrations/gmail/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGmailOAuthConfigured(): boolean {
  return clientConfig() !== null;
}

export function buildGmailAuthUrl(state: string): string | null {
  const cfg = clientConfig();
  if (!cfg) return null;
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeGmailCode(code: string): Promise<GoogleTokenBundle> {
  const cfg = clientConfig();
  if (!cfg) throw new Error("Gmail OAuth non configurato.");

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
  const json = (await res.json()) as GoogleTokenBundle & { error?: string };
  if (!res.ok || !json.refresh_token) {
    throw new Error(json.error ?? "Token exchange fallito");
  }
  return json;
}

export async function saveGmailTokens(userId: string, tokens: GoogleTokenBundle): Promise<void> {
  const cipher = encryptJson(tokens);
  await prisma.userOAuthConnection.upsert({
    where: { userId_provider: { userId, provider: PROVIDER } },
    create: { userId, provider: PROVIDER, tokenCipher: cipher },
    update: { tokenCipher: cipher },
  });
}

export async function deleteGmailConnection(userId: string): Promise<void> {
  await prisma.userOAuthConnection.deleteMany({
    where: { userId, provider: PROVIDER },
  });
}

export async function loadGmailTokens(userId: string): Promise<GoogleTokenBundle | null> {
  const row = await prisma.userOAuthConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });
  if (!row) return null;
  return decryptJson<GoogleTokenBundle>(row.tokenCipher);
}

export async function getGmailAccessToken(userId: string): Promise<string | null> {
  const tokens = await loadGmailTokens(userId);
  if (!tokens?.refresh_token) return null;

  if (tokens.access_token && tokens.expiry_date && tokens.expiry_date > Date.now() + 60_000) {
    return tokens.access_token;
  }

  const cfg = clientConfig();
  if (!cfg) return null;

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) return null;

  const updated: GoogleTokenBundle = {
    ...tokens,
    access_token: json.access_token,
    expiry_date: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  await saveGmailTokens(userId, updated);
  return json.access_token;
}

export async function isGmailConnected(userId: string): Promise<boolean> {
  const row = await prisma.userOAuthConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
    select: { id: true },
  });
  return Boolean(row);
}
