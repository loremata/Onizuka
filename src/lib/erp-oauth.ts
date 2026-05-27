import { prisma } from "@/lib/prisma";
import type { OAuthProvider } from "@prisma/client";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";

function baseUrl(): string {
  return (
    process.env.ONIZUKA_PRIMARY_HOST?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function isZucchettiOAuthConfigured(): boolean {
  return !!(process.env.ZUCCHETTI_OAUTH_CLIENT_ID?.trim() && process.env.ZUCCHETTI_OAUTH_CLIENT_SECRET?.trim());
}

export function isSapOAuthConfigured(): boolean {
  return !!(process.env.SAP_OAUTH_CLIENT_ID?.trim() && process.env.SAP_OAUTH_CLIENT_SECRET?.trim());
}

export function buildErpOAuthUrl(provider: "ZUCCHETTI_ERP" | "SAP_ERP", userId: string): string | null {
  const state = signOAuthState(userId, provider);
  const redirectUri = `${baseUrl()}/api/integrations/erp-oauth/callback?provider=${provider}`;

  if (provider === "ZUCCHETTI_ERP") {
    const clientId = process.env.ZUCCHETTI_OAUTH_CLIENT_ID?.trim();
    const authUrl = process.env.ZUCCHETTI_OAUTH_AUTH_URL?.trim() || "https://oauth.zucchetti.it/authorize";
    if (!clientId) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "timesheets:write",
      state,
    });
    return `${authUrl}?${params}`;
  }

  const clientId = process.env.SAP_OAUTH_CLIENT_ID?.trim();
  const tenant = process.env.SAP_OAUTH_TENANT?.trim() || "common";
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid offline_access",
    state,
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

export async function completeErpOAuth(params: {
  provider: OAuthProvider;
  code: string;
  state: string;
}): Promise<{ ok: true } | { error: string }> {
  const payload = verifyOAuthState(params.state);
  if (!payload || payload.provider !== params.provider) return { error: "Stato OAuth non valido." };
  const userId = payload.userId;

  const tokenUrl =
    params.provider === "ZUCCHETTI_ERP"
      ? process.env.ZUCCHETTI_OAUTH_TOKEN_URL?.trim() || "https://oauth.zucchetti.it/token"
      : `https://login.microsoftonline.com/${process.env.SAP_OAUTH_TENANT?.trim() || "common"}/oauth2/v2.0/token`;

  const clientId =
    params.provider === "ZUCCHETTI_ERP"
      ? process.env.ZUCCHETTI_OAUTH_CLIENT_ID?.trim()
      : process.env.SAP_OAUTH_CLIENT_ID?.trim();
  const clientSecret =
    params.provider === "ZUCCHETTI_ERP"
      ? process.env.ZUCCHETTI_OAUTH_CLIENT_SECRET?.trim()
      : process.env.SAP_OAUTH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) return { error: "Credenziali OAuth ERP mancanti." };

  const redirectUri = `${baseUrl()}/api/integrations/erp-oauth/callback?provider=${params.provider}`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) return { error: "Scambio token ERP fallito." };

  const tokens = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
  if (!tokens.access_token) return { error: "Token ERP mancante." };

  const cipher = Buffer.from(
    JSON.stringify({ access: tokens.access_token, refresh: tokens.refresh_token ?? null })
  ).toString("base64");

  await prisma.userOAuthConnection.upsert({
    where: { userId_provider: { userId, provider: params.provider } },
    create: { userId, provider: params.provider, tokenCipher: cipher },
    update: { tokenCipher: cipher, updatedAt: new Date() },
  });

  return { ok: true };
}

export async function getErpOAuthAccessToken(
  userId: string,
  provider: OAuthProvider
): Promise<string | null> {
  const row = await prisma.userOAuthConnection.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { tokenCipher: true },
  });
  if (!row?.tokenCipher) return null;
  try {
    const parsed = JSON.parse(Buffer.from(row.tokenCipher, "base64").toString("utf8")) as {
      access?: string;
    };
    return parsed.access ?? null;
  } catch {
    return null;
  }
}
