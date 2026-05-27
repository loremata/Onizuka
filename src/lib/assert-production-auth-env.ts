/**
 * Chiamato da `instrumentation.ts` all’avvio del server (`next start`, dev server).
 * Non blocca `next build` (utile per CI/Docker che buildano senza segreti nel layer).
 */
export function assertProductionNextAuthEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "[next-auth] In produzione serve NEXTAUTH_SECRET di almeno 32 caratteri. Esempio: openssl rand -base64 32"
    );
  }

  const s = secret.toLowerCase();
  const placeholderHints = [
    "generate-with-openssl",
    "change-me",
    "your-secret",
    "replace-me",
    "secret-key-here",
    "changeme",
  ];
  if (placeholderHints.some((p) => s.includes(p))) {
    throw new Error(
      "[next-auth] NEXTAUTH_SECRET sembra un placeholder: imposta un valore casuale forte in produzione."
    );
  }

  const url = process.env.NEXTAUTH_URL?.trim();
  if (!url) {
    throw new Error(
      "[next-auth] In produzione serve NEXTAUTH_URL con l’URL pubblico dell’app (es. https://tuodominio.com)."
    );
  }

  const u = url.toLowerCase();
  const localHttpOk =
    u.startsWith("http://localhost") ||
    u.startsWith("http://127.0.0.1") ||
    u.startsWith("http://[::1]");
  if (!localHttpOk && !u.startsWith("https://")) {
    throw new Error(
      "[next-auth] In produzione NEXTAUTH_URL deve usare https:// (eccezione: http://localhost solo per test locali)."
    );
  }
}
