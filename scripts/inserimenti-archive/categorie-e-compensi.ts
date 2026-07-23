/**
 * 1. Categoria "Telefono incluso": raccoglie i dispositivi rateizzati, sia a
 *    nuovi clienti insieme alla SIM sia a clienti già in base (CB).
 *    Prima si chiamava "Rate" e teneva già TIM TIMFin e Fastweb Tel Inc.
 *
 * 2. Compensi per singola offerta Fastweb, IPOTIZZATI dal piano C.Net 2023
 *    (scaglione massimo, che è quello che si applica: le soglie le sfonda il
 *    gruppo). Vanno confermati con la lettera aggiornata.
 *
 * Uso: npx tsx scripts/categorie-e-compensi.ts
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Ipotesi sui compensi per offerta, per analogia col piano 2023:
 *   Wireline ≥46: Casa Light 145 · NeXXt Casa 180 · +Booster 210 · Casa Plus 240
 *   Mobile Ric.Automatica ≥220: NeXXt Mobile 48 · Full 58 · Maxi 98
 * L'accostamento nome-vecchio → nome-nuovo è una MIA ipotesi, non un dato.
 */
const IPOTESI: { name: string; compenso: number; nota: string }[] = [
  { name: "Fastweb Casa Start", compenso: 145, nota: "≈ NeXXt Casa Light (entry)" },
  { name: "Fastweb Casa FWA Light", compenso: 145, nota: "≈ Casa Light, su FWA" },
  { name: "Fastweb Casa Pro", compenso: 180, nota: "≈ NeXXt Casa (media)" },
  { name: "Fastweb Casa Ultra", compenso: 240, nota: "≈ Casa Plus (top)" },
  { name: "Fastweb Mobile Start", compenso: 48, nota: "≈ NeXXt Mobile (entry)" },
  { name: "Fastweb Mobile Pro", compenso: 58, nota: "≈ Mobile Full" },
  { name: "Fastweb Mobile Power", compenso: 78, nota: "interpolato fra Full e Maxi" },
  { name: "Fastweb Mobile Ultra", compenso: 98, nota: "≈ NeXXt Mobile Maxi (top)" },
];

async function main() {
  const owner = (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }))!;

  // 1 · categoria "Telefono incluso"
  const rinominate = await prisma.incentiveLine.updateMany({
    where: { category: "Rate", plan: { ownerUserId: owner.id } },
    data: { category: "Telefono incluso" },
  });
  await prisma.incentiveLine.updateMany({
    where: { key: "TIMFIN", plan: { ownerUserId: owner.id } },
    data: {
      label: "TIMFin — telefono incluso (gara VALORE)",
      rules:
        "Telefoni e dispositivi rateizzati, sia contestuali all'attivazione di una SIM sia su clienti già in base (CB). Gettone a soglia sul volume del mese. Pack 2x1 pesa ×2, pack X3 ×3. Rata ≤2 €: conta solo per la soglia, gettone fisso 15 €.",
    },
  });
  await prisma.incentiveLine.updateMany({
    where: { key: "TEL_INC", plan: { ownerUserId: owner.id } },
    data: {
      label: "Fastweb — telefono incluso",
      rules: "Dispositivi a rate, anche a clienti già in base. Pista monitorata, senza target.",
    },
  });
  console.log(`categoria "Telefono incluso": ${rinominate.count} piste`);

  // 2 · compensi ipotizzati per offerta
  let n = 0;
  for (const i of IPOTESI) {
    const o = await prisma.storeOffer.findFirst({
      where: { ownerUserId: owner.id, brand: "FASTWEB", name: i.name },
    });
    if (!o) {
      console.log(`  ⚠ offerta non trovata: ${i.name}`);
      continue;
    }
    await prisma.storeOffer.update({
      where: { id: o.id },
      data: {
        compensoEur: new Prisma.Decimal(i.compenso),
        target: `IPOTESI ${i.nota} — da confermare con la lettera Fastweb aggiornata`,
      },
    });
    n++;
  }
  console.log(`compensi per offerta ipotizzati: ${n}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
