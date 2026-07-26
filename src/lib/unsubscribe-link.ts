/**
 * Helper per il link pubblico di disiscrizione marketing (GDPR).
 * Serve al footer "Disiscriviti" delle email di campagna.
 *
 * L'URL è assoluto e usa la base pubblica dell'app (stesso pattern dei link report `/report/[token]`):
 * env NEXTAUTH_URL, con fallback APP_URL e infine il dominio di produzione.
 */

/** Base URL pubblico dell'app, senza slash finale. */
function appBaseUrl(): string {
  const base = process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim() || "https://onizuka.it";
  return base.replace(/\/$/, "");
}

/**
 * Compone l'URL assoluto di disiscrizione per un dato token opaco del Client
 * (`Client.marketingOptOutToken`). Il token viene URL-encodato per sicurezza.
 */
export function buildUnsubscribeUrl(token: string): string {
  return `${appBaseUrl()}/api/public/unsubscribe/${encodeURIComponent(token)}`;
}
