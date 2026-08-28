/**
 * Configurazione IMAP condivisa: la casella dell'outreach è UNA — quella da cui
 * partono le mail, quella in cui tornano le risposte, quella in cui va archiviata
 * la copia degli invii. Tenere la stessa logica in due posti significherebbe, un
 * giorno, leggere le risposte in una casella e archiviare in un'altra.
 *
 * Credenziali: quelle SMTP già configurate (`GMAIL_SMTP_*`, oggi Hostinger), con
 * override facoltativo `OUTREACH_IMAP_*` se un giorno le due caselle divergono.
 */
export type ImapConfig = { host: string; user: string; pass: string };

export function imapConfig(): ImapConfig | null {
  const user = process.env.OUTREACH_IMAP_USER?.trim() || process.env.GMAIL_SMTP_USER?.trim();
  const pass = process.env.OUTREACH_IMAP_PASSWORD?.trim() || process.env.GMAIL_SMTP_PASSWORD?.trim();
  if (!user || !pass) return null;
  const host =
    process.env.OUTREACH_IMAP_HOST?.trim() ||
    // Hostinger: smtp.hostinger.com → imap.hostinger.com. Per altri provider
    // impostare OUTREACH_IMAP_HOST esplicitamente.
    (process.env.GMAIL_SMTP_HOST ?? "").replace(/^smtp\./i, "imap.") ||
    "imap.hostinger.com";
  return { host, user, pass };
}
