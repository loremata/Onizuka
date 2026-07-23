// Verifica end-to-end: carica i piani dal DB e fa girare il motore su uno
// scenario di esempio. Prova che il ciclo DB → engine funziona su dati veri.
// Uso: npx tsx scripts/verify-inserimenti.ts
import { prisma } from "@/lib/prisma";
import { loadPlan } from "@/lib/inserimenti/load-plan";
import { computeMonth, focusNow, type Sale } from "@/lib/inserimenti/engine";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Nessun ADMIN");

  // scenario TIM di esempio: 21 MNP domiciliate a 9,99 + 16 AL a 9,99 (toglie penalità)
  const tim = await loadPlan(admin.id, "TIM", "2026-07");
  if (!tim) throw new Error("Piano TIM non trovato — esegui prima seed-inserimenti");
  const timSales: Sale[] = [
    ...Array.from({ length: 21 }, () => ({ lineKey: "MNP", feeEur: 9.99, domiciled: true })),
    ...Array.from({ length: 16 }, () => ({ lineKey: "AL_PP", feeEur: 9.99, domiciled: false })),
    ...Array.from({ length: 4 }, () => ({ lineKey: "ENERGIA", domiciled: false })),
  ];
  const timR = computeMonth(tim, timSales, {});
  console.log(`\n=== TIM (${tim.engineVersion}) ===`);
  for (const l of timR.lines) if (l.qty > 0) console.log(`  ${l.label}: ${l.qty} pz → ${l.compenso} € (scaglione ${l.tierIndex + 1})`);
  console.log(`  extra: ${timR.extras} €`);
  for (const p of timR.prizes) console.log(`  ${p.label}: punti ${p.points}, cancelli ${p.gateOpen ? "OK" : "chiusi (" + p.worstGate?.lineKey + " -" + p.worstGate?.missing + ")"} → ${p.prize} €`);
  console.log(`  TOTALE TIM: ${timR.total} €`);
  const focus = focusNow(tim, timR);
  if (focus[0]) console.log(`  FOCUS ORA: ${focus[0].label} — mancano ${focus[0].missing}, +${focus[0].stepValue} € allo scatto`);

  // scenario Eni lineare
  const eni = await loadPlan(admin.id, "ENI", "2026-07");
  if (eni) {
    const eniSales: Sale[] = Array.from({ length: 10 }, () => ({ lineKey: "TELEPASS", domiciled: false }));
    const eniR = computeMonth(eni, eniSales, {});
    console.log(`\n=== ENI (${eni.engineVersion}) ===`);
    console.log(`  TOTALE: ${eniR.total} € (10 Telepass × 5)`);
    console.log(`  focus: ${focusNow(eni, eniR).length} voci (atteso 0: lineare)`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
