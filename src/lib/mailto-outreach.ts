export function buildMailtoUrl(params: {
  to?: string;
  subject: string;
  body: string;
}): string {
  const q = new URLSearchParams({
    subject: params.subject,
    body: params.body,
  });
  const base = params.to ? `mailto:${encodeURIComponent(params.to)}` : "mailto:";
  return `${base}?${q.toString()}`;
}

export type GmailSendMode = "smtp" | "mailto";

export function resolveGmailSendMode(): GmailSendMode {
  const host = process.env.GMAIL_SMTP_HOST;
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_PASSWORD;
  if (host && user && pass) return "smtp";
  return "mailto";
}
