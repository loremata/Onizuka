/**
 * Listino Fastweb Mobile: canoni corretti e varianti ricaricabili.
 *
 * Segnalato da Lorenzo il 03/08/2026: i canoni a listino erano sfalsati di uno
 * scaglione — ogni offerta portava il prezzo di quella sotto. Non toccava i
 * compensi (su Fastweb il compenso sta sull'offerta, non sul canone) ma il
 * canone è quello che si vede al banco quando si registra, e sbagliato lì
 * porta a scegliere l'offerta sbagliata.
 *
 *   Start  7,95 → 9,95   ·  Pro   9,95 → 11,95
 *   Power 11,95 → 14,95  ·  Ultra 14,95 → 19,95
 *
 * Ogni offerta può essere venduta domiciliata o ricaricabile. Il compenso
 * delle domiciliate è quello già a listino; per le ricaricabili, in attesa
 * dell'incentivazione ufficiale, si usa **un terzo** del domiciliato, come
 * deciso da Lorenzo. Quando arriva la lettera si aggiornano i quattro valori
 * qui sotto e basta.
 *
 * Idempotente.
 *   npx tsx scripts/listino-fastweb-mobile.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const MOBILE = [
  { code: "FW-FASTWEB-MOBILE-START", nome: "Fastweb Mobile Start", canone: 9.95, compenso: 86 },
  { code: "FW-FASTWEB-MOBILE-PRO", nome: "Fastweb Mobile Pro", canone: 11.95, compenso: 58 },
  { code: "FW-FASTWEB-MOBILE-POWER", nome: "Fastweb Mobile Power", canone: 14.95, compenso: 78 },
  { code: "FW-FASTWEB-MOBILE-ULTRA", nome: "Fastweb Mobile Ultra", canone: 19.95, compenso: 136 },
];

/** Un terzo, arrotondato al centesimo. Provvisorio: vedi intestazione. */
const compensoRicaricabile = (domiciliato: number) => Math.round((domiciliato / 3) * 100) / 100;

async function main() {
  const owner = await prisma.storeOffer.findFirst({ where: { brand: "FASTWEB" }, select: { ownerUserId: true } });
  if (!owner) throw new Error("nessuna offerta Fastweb: listino non inizializzato");

  for (const o of MOBILE) {
    // 1. canone corretto sull'offerta domiciliata
    const dom = await prisma.storeOffer.updateMany({
      where: { ownerUserId: owner.ownerUserId, brand: "FASTWEB", code: o.code },
      data: {
        feeEur: new Prisma.Decimal(o.canone),
        compensoEur: new Prisma.Decimal(o.compenso),
        name: `${o.nome} (domiciliata)`,
      },
    });

    // 2. variante ricaricabile, con un terzo del compenso
    const codeRic = `${o.code}-RIC`;
    const ric = compensoRicaricabile(o.compenso);
    const esiste = await prisma.storeOffer.findFirst({
      where: { ownerUserId: owner.ownerUserId, brand: "FASTWEB", code: codeRic },
    });
    const dati = {
      name: `${o.nome} (ricaricabile)`,
      feeEur: new Prisma.Decimal(o.canone),
      compensoEur: new Prisma.Decimal(ric),
      lineKey: "MOBILE",
      active: true,
    };
    if (esiste) await prisma.storeOffer.update({ where: { id: esiste.id }, data: dati });
    else
      await prisma.storeOffer.create({
        data: { ownerUserId: owner.ownerUserId, brand: "FASTWEB", code: codeRic, ...dati },
      });

    console.log(`  ${o.nome.padEnd(22)} canone ${o.canone} · domiciliata ${o.compenso} € · ricaricabile ${ric} €${dom.count ? "" : "  ⚠ offerta domiciliata non trovata"}`);
  }
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
