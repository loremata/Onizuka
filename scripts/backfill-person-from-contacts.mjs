/**
 * Backfill Person + PersonClientRole da ClientContact esistenti.
 * Uso: npx tsx scripts/backfill-person-from-contacts.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 1,
  });
  const ownerUserId = admins[0]?.id;
  if (!ownerUserId) {
    console.error("Nessun admin trovato.");
    process.exit(1);
  }

  const contacts = await prisma.clientContact.findMany({
    include: { client: { select: { id: true } } },
  });

  let created = 0;
  for (const c of contacts) {
    const emailNorm = c.email?.trim().toLowerCase() || null;
    let person = emailNorm
      ? await prisma.person.findFirst({
          where: { ownerUserId, email: { equals: emailNorm, mode: "insensitive" } },
        })
      : null;

    if (!person) {
      person = await prisma.person.create({
        data: {
          ownerUserId,
          fullName: c.name.trim(),
          email: c.email?.trim() || null,
          phone: c.phone?.trim() || null,
        },
      });
      created++;
    }

    await prisma.personClientRole.upsert({
      where: {
        personId_clientId: { personId: person.id, clientId: c.clientId },
      },
      create: {
        personId: person.id,
        clientId: c.clientId,
        role: c.role,
        isPrimary: c.isPrimary,
      },
      update: {
        role: c.role,
        isPrimary: c.isPrimary,
      },
    });
  }

  console.log(`Backfill completato: ${contacts.length} referenti, ${created} persone nuove.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
