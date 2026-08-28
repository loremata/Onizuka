import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { ImapFlow } from "imapflow";
import { imapConfig } from "@/lib/imap-config";

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

/**
 * COPIA IN «POSTA INVIATA».
 *
 * Un server SMTP consegna e basta: la copia nella cartella "Inviata" la mette il
 * CLIENT di posta, non il server. Spedendo da codice quella copia non la metteva
 * nessuno, e il 28/08 il risultato era una casella con zero messaggi inviati e
 * un database che diceva "mail partita": nessuno dei due era sbagliato, ma
 * insieme facevano dubitare della macchina. E senza l'originale, quando il
 * prospect risponde, non hai sotto gli occhi quello che gli avevi scritto.
 *
 * Qui la copia viene aggiunta via IMAP nella stessa casella da cui la mail è
 * partita, con lo stesso Message-ID di quella consegnata (così la risposta si
 * aggancia al messaggio giusto). È best-effort: se l'archiviazione fallisce, la
 * mail resta inviata — non si annulla una consegna riuscita per una copia.
 */
const ARCHIVIO_TIMEOUT_MS = 8000;

/** Attesa con scadenza: l'archiviazione non deve tenere in ostaggio l'invio. */
async function conScadenza<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`scaduto dopo ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Quale cartella è la "Posta inviata". Prima l'attributo standard (`\\Sent`), che è
 * l'unico modo affidabile; poi il nome, perché il nome cambia con il provider e
 * con la lingua (Hostinger usa "INBOX.Sent", altri "Sent" o "Posta inviata").
 * Esportata per poterla provare senza una casella vera.
 */
export function scegliCartellaInviata(
  cartelle: { path: string; specialUse?: string }[]
): string | null {
  const perUso = cartelle.find((c) => c.specialUse === "\\Sent");
  if (perUso) return perUso.path;
  const perNome = cartelle.find((c) => /(^|\.)(sent|posta inviata|inviata)$/i.test(c.path));
  return perNome?.path ?? null;
}

async function trovaCartellaInviata(client: ImapFlow): Promise<string | null> {
  return scegliCartellaInviata(await client.list());
}

async function archiviaInPostaInviata(raw: Buffer): Promise<void> {
  const cfg = imapConfig();
  if (!cfg) return;
  const client = new ImapFlow({
    host: cfg.host,
    port: 993,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  await client.connect();
  try {
    const cartella = await trovaCartellaInviata(client);
    if (!cartella) return;
    await client.append(cartella, raw, ["\\Seen"]);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

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

  const mailOptions: Mail.Options = {
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
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    // La mail e' consegnata: da qui in poi nulla puo' farla "non partita". La
    // copia in archivio si tenta, e se non riesce si scrive nel log e si prosegue.
    try {
      const raw = await new MailComposer({ ...mailOptions, messageId: info.messageId })
        .compile()
        .build();
      await conScadenza(archiviaInPostaInviata(raw), ARCHIVIO_TIMEOUT_MS);
    } catch (e) {
      console.error(
        "[smtp] copia in Posta inviata non riuscita:",
        e instanceof Error ? e.message : e
      );
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invio fallito";
    return { ok: false, error: msg };
  }
}
