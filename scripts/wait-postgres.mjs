/**
 * Attende che Postgres risponda su DATABASE_URL (max ~30s).
 */
import { PrismaClient } from "@prisma/client";

const maxAttempts = 15;
const delayMs = 2000;

const prisma = new PrismaClient();

for (let i = 1; i <= maxAttempts; i++) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("PostgreSQL pronto.");
    await prisma.$disconnect();
    process.exit(0);
  } catch {
    if (i === maxAttempts) {
      console.error(
        "PostgreSQL non raggiungibile. Avvia Docker Desktop e: npm run db:up"
      );
      await prisma.$disconnect();
      process.exit(1);
    }
    console.log(`In attesa di PostgreSQL (${i}/${maxAttempts})…`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}
