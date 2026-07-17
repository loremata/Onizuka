// Seed dei piani provvigionali del modulo Inserimenti sul primo utente ADMIN.
// Uso: npx tsx scripts/seed-inserimenti.ts
import { prisma } from "@/lib/prisma";
import { seedInserimentiPlans } from "@/lib/inserimenti/seed";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) {
    console.error("Nessun utente ADMIN trovato. Esegui prima `npm run db:seed`.");
    process.exit(1);
  }
  console.log(`Owner: ${admin.email} (${admin.id})`);
  const results = await seedInserimentiPlans(admin.id);
  for (const r of results) console.log(`  ${r.brand}: ${r.lines} piste, ${r.prizes} premi`);
  console.log("Fatto.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
