import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
`;
console.log(rows.map((r) => r.tablename).join("\n"));
try {
  const mig = await prisma.$queryRaw`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at`;
  console.log("\n_migrations:", mig);
} catch {
  console.log("\n(no _prisma_migrations table)");
}
await prisma.$disconnect();
