import { createSign } from "crypto";

export type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function parseGoogleServiceAccount(): GoogleServiceAccount | null {
  const raw =
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as GoogleServiceAccount;
    if (!sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

export function isGoogleServiceAccountConfigured(): boolean {
  return Boolean(parseGoogleServiceAccount());
}

export async function getGoogleServiceAccountAccessToken(scope: string): Promise<string | null> {
  const sa = parseGoogleServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .end()
    .sign(sa.private_key.replace(/\\n/g, "\n"), "base64url");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}
