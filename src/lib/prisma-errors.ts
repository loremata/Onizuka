import { Prisma } from "@prisma/client";

/** Postgres non raggiungibile (Docker spento, porta errata, ecc.). */
export function isPrismaConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("Can't reach database server") || msg.includes("Connection refused") || msg.includes("ECONNREFUSED")) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || msg.includes("P1001");
  }
  return false;
}

/** Tabella mancante o schema non allineato (migrazioni non applicate). */
export function isPrismaMissingTable(error: unknown, table?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const msg = String(error.message);
  if (error.code === "P2021") {
    if (!table) return true;
    const metaTable = String(error.meta?.table ?? "");
    if (metaTable === table || metaTable.endsWith(`.${table}`) || metaTable.includes(table)) {
      return true;
    }
  }
  if (!msg.includes("does not exist")) return false;
  if (!table) return true;
  return (
    msg.includes(`\`${table}\``) ||
    msg.includes(`"${table}"`) ||
    msg.includes(`public.${table}`) ||
    msg.includes(`.${table}`)
  );
}
