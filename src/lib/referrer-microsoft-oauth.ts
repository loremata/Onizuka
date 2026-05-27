import { prisma } from "@/lib/prisma";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { setReferrerPortalSession } from "@/lib/referrer-portal-session";
import { publicReferBaseUrl } from "@/lib/referrer-magic-link";

function msTenant(): string {
  return process.env.REFERRER_MICROSOFT_TENANT?.trim() || "common";
}

function msClientId(): string | null {
  return process.env.REFERRER_MICROSOFT_CLIENT_ID?.trim() || null;
}

function msClientSecret(): string | null {
  return process.env.REFERRER_MICROSOFT_CLIENT_SECRET?.trim() || null;
}

export function isReferrerMicrosoftOAuthConfigured(): boolean {
  return !!(msClientId() && msClientSecret());
}

export function buildReferrerMicrosoftAuthUrl(submissionToken: string): string | null {
  const clientId = msClientId();
  if (!clientId) return null;
  const state = signOAuthState(submissionToken, "REFERRER_MICROSOFT");
  const redirectUri = `${publicReferBaseUrl()}/api/refer/oauth/microsoft/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile User.Read",
    state,
    response_mode: "query",
  });
  return `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize?${params}`;
}

export async function completeReferrerMicrosoftOAuth(params: {
  code: string;
  state: string;
}): Promise<{ ok: true } | { error: string }> {
  const payload = verifyOAuthState(params.state);
  if (!payload || payload.provider !== "REFERRER_MICROSOFT") {
    return { error: "Stato OAuth non valido." };
  }
  const submissionToken = payload.userId;

  const clientId = msClientId();
  const clientSecret = msClientSecret();
  if (!clientId || !clientSecret) return { error: "Microsoft OAuth non configurato." };

  const redirectUri = `${publicReferBaseUrl()}/api/refer/oauth/microsoft/callback`;
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: params.code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    }
  );
  if (!tokenRes.ok) return { error: "Scambio token Microsoft fallito." };

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return { error: "Token Microsoft mancante." };

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return { error: "Profilo Microsoft non leggibile." };

  const profile = (await profileRes.json()) as { mail?: string; userPrincipalName?: string };
  const email = (profile.mail ?? profile.userPrincipalName ?? "").trim().toLowerCase();
  if (!email) return { error: "Email Microsoft non disponibile." };

  const referrer = await prisma.referrer.findFirst({
    where: {
      submissionToken,
      active: true,
      OR: [{ email: { equals: email, mode: "insensitive" } }, { microsoftEmail: email }],
    },
    select: { id: true },
  });
  if (!referrer) {
    return {
      error:
        "Nessun segnalatore attivo con questa email Microsoft. Collega microsoftEmail sulla scheda segnalatore.",
    };
  }

  await prisma.referrer.update({
    where: { id: referrer.id },
    data: { microsoftEmail: email },
  });

  await setReferrerPortalSession(referrer.id);
  return { ok: true };
}
