import { findClientDuplicateGroups } from "@/lib/client-dedupe";
import { maybeSendDedupeScanAlertEmail } from "@/lib/dedupe-alert-email";
import { prisma } from "@/lib/prisma";

export async function runDedupeScanForOwner(ownerUserId: string, runId: string): Promise<void> {
  const run = await prisma.dedupeScanRun.findFirst({
    where: { id: runId, ownerUserId },
  });
  if (!run) return;

  await prisma.dedupeScanRun.update({
    where: { id: runId },
    data: { status: "RUNNING" },
  });

  try {
    const groups = await findClientDuplicateGroups({ fuzzyIndexedClients: run.fuzzyIndexedClients });
    const summary = groups.slice(0, 80).map((g) => ({
      key: g.key,
      reason: g.reason,
      count: g.clients.length,
      names: g.clients.slice(0, 4).map((c) => c.companyName),
    }));

    await prisma.dedupeScanRun.update({
      where: { id: runId },
      data: {
        status: "DONE",
        groupCount: groups.length,
        summaryJson: JSON.stringify({ groups: summary, totalClients: groups.reduce((a, g) => a + g.clients.length, 0) }),
        completedAt: new Date(),
      },
    });
    void maybeSendDedupeScanAlertEmail(ownerUserId, runId, groups.length).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore scansione";
    await prisma.dedupeScanRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorDetail: msg.slice(0, 2000), completedAt: new Date() },
    });
  }
}

export async function startDedupeScan(ownerUserId: string, fuzzyIndexedClients = 10000): Promise<string> {
  const run = await prisma.dedupeScanRun.create({
    data: { ownerUserId, fuzzyIndexedClients, status: "PENDING" },
  });
  void runDedupeScanForOwner(ownerUserId, run.id);
  return run.id;
}
