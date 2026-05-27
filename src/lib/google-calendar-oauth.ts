import type { OAuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptJson, encryptJson } from "@/lib/token-crypto";

const SCOPES =
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events";
const PROVIDER: OAuthProvider = "GOOGLE_CALENDAR";

export type GoogleTokenBundle = {
  refresh_token: string;
  access_token?: string;
  expiry_date?: number;
};

function clientConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ??
    `${process.env.NEXTAUTH_URL?.replace(/\/$/, "")}/api/integrations/google-calendar/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleCalendarConfigured(): boolean {
  return clientConfig() !== null;
}

export function buildGoogleCalendarAuthUrl(state: string): string | null {
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

export async function exchangeGoogleCalendarCode(code: string): Promise<GoogleTokenBundle> {
  const cfg = clientConfig();
  if (!cfg) throw new Error("Google Calendar non configurato.");

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

export async function saveGoogleCalendarTokens(
  userId: string,
  tokens: GoogleTokenBundle,
  accountEmail?: string | null
): Promise<void> {
  const cipher = encryptJson(tokens);
  await prisma.userOAuthConnection.upsert({
    where: { userId_provider: { userId, provider: PROVIDER } },
    create: { userId, provider: PROVIDER, tokenCipher: cipher, accountEmail: accountEmail ?? null },
    update: { tokenCipher: cipher, accountEmail: accountEmail ?? null },
  });
}

export async function deleteGoogleCalendarConnection(userId: string): Promise<void> {
  await prisma.userOAuthConnection.deleteMany({
    where: { userId, provider: PROVIDER },
  });
}

export async function loadGoogleCalendarTokens(userId: string): Promise<GoogleTokenBundle | null> {
  const row = await prisma.userOAuthConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });
  if (!row) return null;
  return decryptJson<GoogleTokenBundle>(row.tokenCipher);
}

export async function getGoogleCalendarAccessToken(userId: string): Promise<string | null> {
  const tokens = await loadGoogleCalendarTokens(userId);
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
  await saveGoogleCalendarTokens(userId, updated);
  return json.access_token;
}

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink?: string;
};

export async function listGoogleCalendarEvents(
  userId: string,
  days = 7
): Promise<GoogleCalendarEvent[] | null> {
  const access = await getGoogleCalendarAccessToken(userId);
  if (!access) return null;

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86400_000).toISOString();
  const p = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${p.toString()}`,
    { headers: { Authorization: `Bearer ${access}` } }
  );
  if (!res.ok) return null;

  const json = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  return (json.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? "(Senza titolo)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    htmlLink: e.htmlLink,
  }));
}

export async function isGoogleCalendarConnected(userId: string): Promise<boolean> {
  const row = await prisma.userOAuthConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
    select: { id: true },
  });
  return Boolean(row);
}

export type FlowCalendarEventInput = {
  taskId: string;
  title: string;
  dueDate: Date;
  clientName?: string | null;
};

/** Evento 30 min sul calendario primario (richiede scope calendar.events). */
export async function createGoogleCalendarFlowEvent(
  userId: string,
  input: FlowCalendarEventInput
): Promise<{ eventId: string; htmlLink?: string } | null> {
  const access = await getGoogleCalendarAccessToken(userId);
  if (!access) return null;

  const appBase = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  const start = input.dueDate;
  const end = new Date(start.getTime() + 30 * 60_000);
  const lines = [
    "Task Flow Onizuka",
    input.clientName ? `Cliente: ${input.clientName}` : null,
    appBase ? `${appBase}/admin/flow` : null,
  ].filter(Boolean);

  const body = {
    summary: `[Onizuka] ${input.title}`,
    description: lines.join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: { onizukaFlowTaskId: input.taskId },
    },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    console.error("[google-calendar] create event", err.error?.message ?? res.status);
    return null;
  }

  const json = (await res.json()) as { id?: string; htmlLink?: string };
  if (!json.id) return null;
  return { eventId: json.id, htmlLink: json.htmlLink };
}
