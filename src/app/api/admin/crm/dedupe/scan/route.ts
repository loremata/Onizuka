import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/auth-roles";
import { jsonApiError } from "@/lib/api-json-errors";
import { startDedupeScan, runDedupeScanForOwner } from "@/lib/dedupe-scan-run";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isFullAdmin(session.user.role)) {
    return jsonApiError(401, "UNAUTHORIZED", "Solo admin.");
  }

  const body = (await request.json().catch(() => ({}))) as { fuzzyIndexedClients?: number };
  const cap = Math.min(10000, Math.max(1200, Math.round(body.fuzzyIndexedClients ?? 10000)));

  const runId = await startDedupeScan(session.user.id, cap);
  return NextResponse.json({ ok: true, runId });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isFullAdmin(session.user.role)) {
    return jsonApiError(401, "UNAUTHORIZED", "Solo admin.");
  }

  const runId = request.nextUrl.searchParams.get("runId");
  if (runId) {
    const run = await prisma.dedupeScanRun.findFirst({
      where: { id: runId, ownerUserId: session.user.id },
    });
    if (!run) return jsonApiError(404, "NOT_FOUND", "Scansione non trovata.");
    if (run.status === "PENDING" || run.status === "RUNNING") {
      await runDedupeScanForOwner(session.user.id, runId);
      const updated = await prisma.dedupeScanRun.findFirst({ where: { id: runId } });
      return NextResponse.json({ run: updated });
    }
    return NextResponse.json({ run });
  }

  const latest = await prisma.dedupeScanRun.findFirst({
    where: { ownerUserId: session.user.id },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ run: latest });
}
