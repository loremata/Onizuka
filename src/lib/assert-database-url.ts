/**
 * Avvisi all'avvio in produzione per DATABASE_URL compatibile con Vercel + Supabase.
 */
export function assertProductionDatabaseUrl(): void {
  if (process.env.NODE_ENV !== "production") return;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;

  const lower = url.toLowerCase();
  const isSupabase = lower.includes("supabase.co") || lower.includes("pooler.supabase.com");

  if (isSupabase) {
    const hasPooler =
      lower.includes("pooler.supabase.com") ||
      lower.includes("pgbouncer=true") ||
      lower.includes(":6543/");
    if (!hasPooler) {
      console.warn(
        "[onizuka] Supabase: per Vercel/serverless usa la connection string «Transaction pooler» (porta 6543) in DATABASE_URL. " +
          "Migrazioni Prisma: DIRECT_URL con connessione diretta (porta 5432). Vedi docs/DEPLOY.md."
      );
    }
  }

  if (!process.env.DIRECT_URL?.trim() && isSupabase) {
    console.warn(
      "[onizuka] DIRECT_URL non impostata: `prisma migrate deploy` da CI/locale può fallire sul pooler Supabase."
    );
  }
}
