import { prisma } from "@/lib/prisma";
import { startDedupeScan } from "@/lib/dedupe-scan-run";

/** Avvia scansione dedupe 10k per tutti gli admin (cron notturno). */
export async function runNightlyDedupeScansForAdmins(): Promise<{ started: number }> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 50,
  });
  let started = 0;
  for (const a of admins) {
    await startDedupeScan(a.id, 10000);
    started += 1;
  }
  return { started };
}
