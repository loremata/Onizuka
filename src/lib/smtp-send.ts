import nodemailer from "nodemailer";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  /**
   * Intestazioni aggiuntive. Servono per `List-Unsubscribe` e
   * `List-Unsubscribe-Post` (RFC 8058): senza di quelle Gmail e Yahoo
   * declassano la posta massiva, e la disiscrizione con un click non funziona.
   */
  headers?: Record<string, string>;
};

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_SMTP_HOST &&
      process.env.GMAIL_SMTP_USER &&
      process.env.GMAIL_SMTP_PASSWORD
  );
}

export async function sendEmailViaSmtp(params: SendEmailParams): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP non configurato" };
  }

  const port = Number(process.env.GMAIL_SMTP_PORT ?? "587");
  const secure = process.env.GMAIL_SMTP_SECURE === "1" || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.GMAIL_SMTP_USER,
      pass: process.env.GMAIL_SMTP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_SMTP_FROM ?? process.env.GMAIL_SMTP_USER,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? params.text.replace(/\n/g, "<br>"),
      headers: params.headers,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? "application/octet-stream",
      })),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invio fallito";
    return { ok: false, error: msg };
  }
}
