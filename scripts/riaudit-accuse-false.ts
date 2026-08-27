/**
 * RIAUDIT DELLE ACCUSE FALSE — la mail può dire solo ciò che è vero adesso.
 *
 * Le prime righe di una mail a freddo sono accuse: «il sito non risponde», «il
 * sito non usa una connessione sicura». Quando l'accusa è sbagliata non si perde
 * solo quel cliente: si perde la faccia in un paese dove ci si conosce.
 *
 * Due difetti della sonda le hanno prodotte a decine:
 *  - si presentava solo come Onizuka-AuditBot e mezzo hosting risponde 403 a chi
 *    non sembra un browser → «sito non raggiungibile» di siti vivissimi;
 *  - provava solo lo schema scritto in anagrafica → «non usa HTTPS» di siti che
 *    l'https ce l'hanno (bastava un http:// salvato anni fa).
 *
 * Questo script riprende le bozze ancora in gioco, rimisura il sito e, dove
 * l'accusa non regge, corregge l'indirizzo in anagrafica, annulla la bozza col
 * motivo scritto e rifà l'audit: la nuova mail nasce dai dati veri.
 *
 * A secco per default:
 *   npx tsx scripts/riaudit-accuse-false.ts             → prova
 *   npx tsx scripts/riaudit-accuse-false.ts --applica   → scrive
 */
import { loadDotEnvFiles, loadEnvFile } from "./load-dotenv.mjs";
loadDotEnvFiles();
// Override del worker: il DB è quello di produzione, come per lo scraper.
loadEnvFile(process.cwd(), ".env.worker", { override: true });
// Il report pubblico deve nascere con l'indirizzo di produzione, non localhost.
process.env.NEXTAUTH_URL = "https://onizuka.it";

const APPLICA = process.argv.includes("--applica");

/** Le accuse verificabili con una sonda, e come si smentiscono. */
const ACCUSE = [
  { nome: "sito non raggiungibile", regex: /non risponde|non raggiungibile/i },
  { nome: "sito senza HTTPS", regex: /connessione sicura|senza HTTPS/i },
] as const;

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { probeWebsite } = await import("@/lib/website-probe");
  const { runDigitalAuditForClient } = await import("@/lib/digital-audit-run");

  const drafts = await prisma.outreachDraft.findMany({
    where: { status: { in: ["PENDING_APPROVAL", "APPROVED"] } },
    select: {
      id: true,
      body: true,
      ownerUserId: true,
      clientId: true,
      leadId: true,
      client: { select: { companyName: true, website: true } },
      lead: { select: { website: true } },
    },
  });

  const conAccuse = drafts.filter((d) => ACCUSE.some((a) => a.regex.test(d.body)));
  console.log(`bozze vive: ${drafts.length} · con un'accusa verificabile: ${conAccuse.length}\n`);

  let smentite = 0;
  for (const d of conAccuse) {
    const nome = d.client?.companyName ?? "—";
    const sito = (d.client?.website || d.lead?.website || "").trim();
    if (!sito || !d.clientId) {
      console.log(`SALTO      ${nome}: nessun sito o nessun cliente collegato.`);
      continue;
    }

    const probe = await probeWebsite(sito);
    // L'anagrafica può avere un indirizzo profondo ormai morto mentre il sito vive:
    // in quel caso è l'indirizzo da correggere, non l'azienda da accusare.
    let buono = probe?.ok ? probe.url : null;
    if (!buono) {
      try {
        const radice = new URL(probe?.url ?? sito).origin;
        const alt = await probeWebsite(radice);
        if (alt?.ok) buono = alt.url;
      } catch {
        /* url non parsabile */
      }
    }

    const dice = {
      irraggiungibile: ACCUSE[0].regex.test(d.body),
      senzaHttps: ACCUSE[1].regex.test(d.body),
    };
    const falso = {
      irraggiungibile: dice.irraggiungibile && Boolean(buono),
      senzaHttps: dice.senzaHttps && Boolean(buono?.startsWith("https://")),
    };

    if (!falso.irraggiungibile && !falso.senzaHttps) {
      console.log(`CONFERMA   ${nome}: l'accusa regge (${sito}).`);
      continue;
    }

    smentite += 1;
    const motivi = [
      falso.irraggiungibile ? "il sito risponde" : "",
      falso.senzaHttps ? "il sito ha l'HTTPS" : "",
    ].filter(Boolean).join(" e ");
    console.log(`DA RIFARE  ${nome}: ${motivi} (${buono}).`);
    if (!APPLICA) continue;

    if (buono && buono.replace(/\/$/, "") !== sito.replace(/\/$/, "")) {
      await prisma.client.update({ where: { id: d.clientId }, data: { website: buono } });
      if (d.leadId) {
        await prisma.lead.update({ where: { id: d.leadId }, data: { website: buono } }).catch(() => undefined);
      }
      console.log(`           indirizzo corretto in anagrafica: ${sito} → ${buono}`);
    }

    await prisma.outreachDraft.update({
      where: { id: d.id },
      data: {
        status: "CANCELLED",
        statusNote: `Annullata: l'accusa non regge (${motivi}). Audit rifatto con la sonda corretta.`,
      },
    });

    const esito = await runDigitalAuditForClient({
      ownerUserId: d.ownerUserId,
      clientId: d.clientId,
      leadId: d.leadId ?? undefined,
      createOutreachDraft: true,
    });
    console.log(`           audit ${esito.auditId} · nuova bozza ${esito.outreachDraftId ?? "(nessuna)"}`);
  }

  console.log(`\naccuse smentite: ${smentite}${APPLICA ? " (bozze rifatte)" : " (prova a secco)"}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
