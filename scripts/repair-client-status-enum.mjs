import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_VALUES = [
  "LEAD_COLD",
  "LEAD_QUALIFIED",
  "CONTACTED",
  "INTERESTED",
  "APPOINTMENT_SET",
  "QUOTE_SENT",
  "NEGOTIATION",
  "ACTIVE_CLIENT",
  "DORMANT",
  "LOST",
  "TO_REACTIVATE",
];

const MAP = [
  ["LEAD_FREDDO", "LEAD_COLD"],
  ["LEAD_QUALIFICATO", "LEAD_QUALIFIED"],
  ["CONTATTATO", "CONTACTED"],
  ["INTERESSATO", "INTERESTED"],
  ["APPUNTAMENTO_FISSATO", "APPOINTMENT_SET"],
  ["PREVENTIVO_INVIATO", "QUOTE_SENT"],
  ["IN_TRATTATIVA", "NEGOTIATION"],
  ["CLIENTE_ATTIVO", "ACTIVE_CLIENT"],
  ["CLIENTE_DORMIENTE", "DORMANT"],
  ["CLIENTE_PERSO", "LOST"],
  ["DA_RIATTIVARE", "TO_REACTIVATE"],
];

for (const value of NEW_VALUES) {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "ClientStatus" ADD VALUE IF NOT EXISTS '${value}'`
  );
  console.log("enum +", value);
}

for (const [from, to] of MAP) {
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "Client" SET status = '${to}'::"ClientStatus" WHERE status::text = '${from}'`
  );
  console.log(`map ${from} -> ${to}`);
}

await prisma.$executeRawUnsafe(
  `ALTER TABLE "Client" ALTER COLUMN status SET DEFAULT 'ACTIVE_CLIENT'::"ClientStatus"`
);

console.log("ClientStatus repair done.");
await prisma.$disconnect();
