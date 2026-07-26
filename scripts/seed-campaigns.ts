// Seed delle campagne cross-sell (Fase 0). Le campagne nascono in DRAFT:
// non arruolano nessuno finché non vengono attivate a mano.
// Uso: npx tsx scripts/seed-campaigns.ts
import { prisma } from "@/lib/prisma";
import { seedCrossSellCampaigns } from "@/lib/campaigns/seed";

async function main() {
  const results = await seedCrossSellCampaigns();
  for (const r of results) {
    console.log(`  ${r.key}: ${r.created ? "creata" : "aggiornata"} (${r.steps} step) — status DRAFT`);
  }
  console.log(`Fatto: ${results.length} campagne cross-sell seminate (DRAFT).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
