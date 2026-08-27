/**
 * TEMPORANEO (27/08/2026) — rifà l'audit dove la mail accusava un sito che invece
 * risponde. La sonda vecchia si presentava solo come Onizuka-AuditBot e mezzo
 * hosting italiano le rispondeva 403: il report scriveva "il sito non risponde"
 * di siti perfettamente vivi, e quella riga era la PRIMA della mail a freddo.
 *
 * A secco per default. Scrive solo con --applica.
 */
import { loadDotEnvFiles, loadEnvFile } from "./load-dotenv.mjs";
loadDotEnvFiles();
loadEnvFile(process.cwd(), ".env.worker", { override: true });
// Il report pubblico deve nascere con l'indirizzo di produzione, non localhost.
process.env.NEXTAUTH_URL = "https://onizuka.it";

const APPLICA = process.argv.includes("--applica");
const ACCUSA = /non risponde|non raggiungibile/i;

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
      client: { select: { id: true, companyName: true, website: true } },
      lead: { select: { id: true, website: true } },
    },
  });
  const sospette = drafts.filter((d) => ACCUSA.test(d.body));
  console.log(`bozze vive: ${drafts.length} · con l'accusa "il sito non risponde": ${sospette.length}\n`);

  for (const d of sospette) {
    const nome = d.client?.companyName ?? "—";
    const sito = (d.client?.website || d.lead?.website || "").trim();
    if (!sito || !d.clientId) {
      console.log(`SALTO ${nome}: nessun sito o nessun cliente collegato.`);
      continue;
    }

    const probe = await probeWebsite(sito);
    let sitoBuono = probe?.ok ? probe.url : null;

    // L'anagrafica può avere un indirizzo profondo ormai morto mentre il sito vive:
    // in quel caso è l'indirizzo da correggere, non l'azienda da accusare.
    if (!sitoBuono) {
      try {
        const radice = new URL(probe?.url ?? sito).origin;
        if (radice !== (probe?.url ?? sito).replace(/\/$/, "")) {
          const probeRadice = await probeWebsite(radice);
          if (probeRadice?.ok) sitoBuono = probeRadice.url;
        }
      } catch {
        /* url non parsabile: resta non raggiungibile */
      }
    }

    if (!sitoBuono) {
      console.log(`CONFERMATO ${nome}: ${sito} non risponde davvero (${probe?.error ?? probe?.statusCode}). La mail dice il vero.`);
      continue;
    }

    console.log(`DA RIFARE  ${nome}: ${sito} risponde (${sitoBuono}).`);
    if (!APPLICA) continue;

    if (sitoBuono.replace(/\/$/, "") !== sito.replace(/\/$/, "")) {
      await prisma.client.update({ where: { id: d.clientId }, data: { website: sitoBuono } });
      if (d.leadId) {
        await prisma.lead.update({ where: { id: d.leadId }, data: { website: sitoBuono } }).catch(() => undefined);
      }
      console.log(`           indirizzo corretto in anagrafica: ${sito} → ${sitoBuono}`);
    }

    await prisma.outreachDraft.update({
      where: { id: d.id },
      data: {
        status: "CANCELLED",
        statusNote: "Annullata: accusava un sito che invece risponde (sonda bloccata come bot). Audit rifatto.",
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

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
