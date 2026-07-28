import { getGmailAccessToken } from "@/lib/gmail-oauth";

function encodeRawEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  /** Intestazioni extra (List-Unsubscribe & co.). I valori con a capo sono scartati. */
  headers?: Record<string, string>;
}): string {
  const from = params.from ?? "me";
  const subjectB64 = `=?UTF-8?B?${Buffer.from(params.subject, "utf8").toString("base64")}?=`;
  // Difesa contro l'iniezione di intestazioni: niente CR/LF nei valori.
  const extraHeaders = Object.entries(params.headers ?? {})
    .filter(([k, v]) => !/[\r\n]/.test(k) && !/[\r\n]/.test(v))
    .map(([k, v]) => `${k}: ${v}`);

  if (params.html) {
    const boundary = `onizuka_${Date.now()}`;
    const body = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      params.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      params.html,
      `--${boundary}--`,
    ].join("\r\n");
    const lines = [
      `From: ${from}`,
      `To: ${params.to}`,
      `Subject: ${subjectB64}`,
      "MIME-Version: 1.0",
      ...extraHeaders,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      body,
    ];
    return Buffer.from(lines.join("\r\n"), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const lines = [
    `From: ${from}`,
    `To: ${params.to}`,
    `Subject: ${subjectB64}`,
    "MIME-Version: 1.0",
    ...extraHeaders,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.text,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailViaApi(
  userId: string,
  params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    headers?: Record<string, string>;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getGmailAccessToken(userId);
  if (!access) return { ok: false, error: "Gmail non collegato." };

  const raw = encodeRawEmail(params);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) || `HTTP ${res.status}` };
  }
  return { ok: true };
}
