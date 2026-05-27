import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cols = await prisma.$queryRaw`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Client'
  ORDER BY column_name
`;
console.log("Client columns:", cols.map((c) => c.column_name).join(", "));

const migrations = await prisma.$queryRaw`
  SELECT migration_name, finished_at, rolled_back_at, logs
  FROM "_prisma_migrations"
  ORDER BY started_at
`;
for (const m of migrations) {
  console.log(
    m.migration_name,
    m.finished_at ? "OK" : m.rolled_back_at ? "ROLLED_BACK" : "FAILED/PENDING"
  );
}

const tables = await prisma.$queryRaw`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('Lead', 'Opportunity', 'Asset', 'MemoryItem', 'ClientContact', 'FlowTask')
  ORDER BY table_name
`;
console.log("Tables:", tables.map((t) => t.table_name).join(", "));

const clientStatus = await prisma.$queryRaw`
  SELECT e.enumlabel
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'ClientStatus'
  ORDER BY e.enumsortorder
`;
console.log("ClientStatus enum:", clientStatus.map((e) => e.enumlabel).join(", "));

const leadCols = await prisma.$queryRaw`
  SELECT column_name, udt_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Lead'
  ORDER BY column_name
`;
console.log("Lead columns:", leadCols.map((c) => `${c.column_name}(${c.udt_name})`).join(", "));

const memCols = await prisma.$queryRaw`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'MemoryItem'
  ORDER BY column_name
`;
console.log("MemoryItem columns:", memCols.map((c) => c.column_name).join(", "));

const assetCols = await prisma.$queryRaw`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Asset'
  ORDER BY column_name
`;
console.log("Asset columns:", assetCols.map((c) => c.column_name).join(", "));

const oppCols = await prisma.$queryRaw`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Opportunity'
  ORDER BY column_name
`;
console.log("Opportunity columns:", oppCols.map((c) => c.column_name).join(", "));

for (const typeName of ["LeadStatus", "OpportunityStatus", "OpportunityPriority"]) {
  const rows = await prisma.$queryRaw`
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = ${typeName}
    ORDER BY e.enumsortorder
  `;
  console.log(`${typeName}:`, rows.map((e) => e.enumlabel).join(", ") || "(missing)");
}

await prisma.$disconnect();
