import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT id FROM "ClientOnboardingItem" LIMIT 0`;
  process.exit(0);
}

main().catch(() => {
  process.exit(1);
});
