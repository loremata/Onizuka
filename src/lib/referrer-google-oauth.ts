import { prisma } from "@/lib/prisma";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { setReferrerPortalSession } from "@/lib/referrer-portal-session";
import { publicReferBaseUrl } from "@/lib/referrer-magic-link";

function googleClientId(): string | null {
  return (
    process.env.REFERRER_GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ||
    process.env.GMAIL_CLIENT_ID?.trim() ||
    null
  );
}

function googleClientSecret(): string | null {
  return (
    process.env.REFERRER_GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ||
    process.env.GMAIL_CLIENT_SECRET?.trim() ||
    null
  );
}

export function isReferrerGoogleOAuthConfigured(): boolean {
  return !!(googleClientId() && googleClientSecret());
}

export function buildReferrerGoogleAuthUrl(submissionToken: string): string | null {
  const clientId = googleClientId();
  if (!clientId) return null;
  const state = signOAuthState(submissionToken, "REFERRER_GOOGLE");
  const redirectUri = `${publicReferBaseUrl()}/api/refer/oauth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function completeReferrerGoogleOAuth(params: {
  code: string;
  state: string;
}): Promise<{ ok: true } | { error: string }> {
  const payload = verifyOAuthState(params.state);
  if (!payload || payload.provider !== "REFERRER_GOOGLE") return { error: "Stato OAuth non valido." };
  const submissionToken = payload.userId;

  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) return { error: "Google OAuth non configurato." };

  const redirectUri = `${publicReferBaseUrl()}/api/refer/oauth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return { error: "Scambio token Google fallito." };

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return { error: "Token Google mancante." };

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return { error: "Profilo Google non leggibile." };

  const profile = (await profileRes.json()) as { email?: string };
  const email = profile.email?.trim().toLowerCase();
  if (!email) return { error: "Email Google non disponibile." };

  const referrer = await prisma.referrer.findFirst({
    where: {
      submissionToken,
      active: true,
      OR: [{ email: { equals: email, mode: "insensitive" } }, { googleEmail: email }],
    },
    select: { id: true },
  });
  if (!referrer) {
    return {
      error:
        "Nessun segnalatore attivo con questa email Google. Chiedi all'agenzia di collegare googleEmail sulla scheda segnalatore.",
    };
  }

  await prisma.referrer.update({
    where: { id: referrer.id },
    data: { googleEmail: email },
  });

  await setReferrerPortalSession(referrer.id);
  return { ok: true };
}
