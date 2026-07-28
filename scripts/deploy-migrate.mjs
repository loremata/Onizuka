// Applica le migration al database di produzione DURANTE il build di Vercel,
// prima di `next build`. Nasce dall'incidente del 17-28 luglio: 7 migration
// sono rimaste non applicate per 11 giorni (l'utente app non era owner delle
// tabelle e nessuno le applicava a mano) e ogni pagina che leggeva un cliente
// era in errore 500. Con questo script il deploy o porta codice E schema
// allineati, o fallisce con un messaggio chiaro — mai piu' drift silenzioso.
//
// Regole:
//  - gira SOLO sui deploy di produzione (VERCEL_ENV=production). I preview
//    build dei branch non devono toccare il database di produzione.
//  - fail-closed: se DIRECT_URL manca o una migration fallisce, il build
//    fallisce. Un sito non deployato e' meglio di un sito rotto online.
//  - dopo le migration, garantisce la RLS su ogni tabella nuova (le migration
//    girano come `prisma`, che e' owner: l'ALTER TABLE e' consentito).
//
// ⚠️ REGOLA ESPANDI/CONTRAI per le migration DISTRUTTIVE (DROP COLUMN/TABLE,
// rinomini): le migration girano a INIZIO build, mentre il deployment vecchio
// serve ancora il traffico con il Prisma Client vecchio — che seleziona tutte
// le colonne del suo schema. Droppare una colonna qui rompe il deploy live per
// i minuti del build. Procedura corretta in due deploy:
//   1° deploy: il codice smette di usare la colonna (schema.prisma senza il
//      campo, NESSUNA migration di drop);
//   2° deploy: la migration di DROP, ormai innocua per il codice live.
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV ?? "";

if (env !== "production") {
  console.log(`[deploy-migrate] VERCEL_ENV="${env || "(locale)"}" → salto le migration (si applicano solo in produzione).`);
  process.exit(0);
}

if (!process.env.DIRECT_URL || !process.env.DATABASE_URL) {
  console.error("");
  console.error("╔══════════════════════════════════════════════════════════════════╗");
  console.error("║ [deploy-migrate] DIRECT_URL o DATABASE_URL mancano tra le env.   ║");
  console.error("║ Senza, le migration non possono essere applicate e il codice     ║");
  console.error("║ andrebbe online con uno schema piu' vecchio (errore 500 diffuso).║");
  console.error("║ Aggiungi le variabili in Vercel → Settings → Environment.        ║");
  console.error("╚══════════════════════════════════════════════════════════════════╝");
  process.exit(1);
}

function run(label, cmd, args) {
  console.log(`[deploy-migrate] ${label}…`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`[deploy-migrate] ${label} FALLITO (exit ${r.status}). Build interrotto.`);
    process.exit(r.status ?? 1);
  }
}

run("prisma migrate deploy", "npx", ["prisma", "migrate", "deploy"]);
run(
  "verifica RLS sulle tabelle nuove",
  "npx",
  ["prisma", "db", "execute", "--file", "prisma/ensure-rls.sql", "--url", process.env.DIRECT_URL]
);

console.log("[deploy-migrate] Schema allineato, RLS garantita. Procedo con next build.");
