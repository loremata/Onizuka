import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

export function isRdsTenantProvisionEnabled(): boolean {
  return !!process.env.ONIZUKA_RDS_MASTER_URL?.trim();
}

function safeDbName(slug: string): string {
  const base = slug.replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 40);
  return `onizuka_${base}_${randomBytes(3).toString("hex")}`;
}

/** Crea database PostgreSQL su cluster RDS/master condiviso. */
export async function createRdsTenantDatabase(slug: string): Promise<
  | { databaseName: string; databaseUrl: string }
  | { error: string }
> {
  const master = process.env.ONIZUKA_RDS_MASTER_URL?.trim();
  if (!master) return { error: "ONIZUKA_RDS_MASTER_URL non configurato." };

  const dbName = safeDbName(slug);
  const admin = new PrismaClient({ datasources: { db: { url: master } } });

  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `CREATE DATABASE fallito: ${msg.slice(0, 500)}` };
  } finally {
    await admin.$disconnect();
  }

  const tenantUrl = master.replace(/(postgresql:\/\/[^/]+\/)([^?]+)/, `$1${dbName}`);
  return { databaseName: dbName, databaseUrl: tenantUrl };
}
