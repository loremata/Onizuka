import { prisma } from "@/lib/prisma";

export type DbMigrationProbe = {
  batchF: boolean;
  hint?: string;
};

/** Verifica che le tabelle del batch F audit siano presenti (migrate deploy eseguito). */
export async function probeBatchFMigration(): Promise<DbMigrationProbe> {
  try {
    await prisma.$queryRaw`SELECT id FROM "ClientOnboardingItem" LIMIT 0`;
    return { batchF: true };
  } catch {
    return {
      batchF: false,
      hint: "Esegui `npx prisma migrate deploy` (migrazione 20260620400000_audit_gap_batch_f).",
    };
  }
}
