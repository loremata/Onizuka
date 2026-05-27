#!/usr/bin/env node
/**
 * Checklist go-live Onizuka — stampa passi e comandi utili.
 * Uso: npm run go-live
 */
const steps = [
  "1. Supabase produzione + R2 + variabili da vercel-env.template su Vercel",
  "2. DIRECT_URL → npm run db:deploy (o workflow Migrate production DB)",
  "3. DNS Hostinger → Vercel, SSL attivo per onizuka.it",
  "4. npm run deploy:verify oppure npm run post-deploy (con BASE_URL + CRON_SECRET)",
  "5. BASE_URL=https://onizuka.it CRON_SECRET=… npm run smoke:prod",
  "6. /admin/go-live → checklist + stato deploy senza blocchi critici",
  "7. Cambia password seed, configura SMTP, N8N_API_KEY, Upstash",
  "8. Google Calendar + Gmail OAuth: collega da Impostazioni",
  "8b. OPENAI_API_KEY opzionale per assistente AI in ricerca",
  "9. Telegram: TELEGRAM_BOT_TOKEN + webhook → /api/integrations/telegram",
  "10. Staging opzionale: vedi docs/STAGING.md",
];

console.log("\n=== Onizuka go-live checklist ===\n");
for (const s of steps) console.log(s);
console.log("\nChecklist: PASSI-MANCANTI.md");
console.log("Indice doc: docs/README.md");
console.log("Locale: npm run passi-mancanti:full");
console.log("Produzione: npm run passi-mancanti:prod\n");
