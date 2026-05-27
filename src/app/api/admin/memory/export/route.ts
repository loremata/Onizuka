import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { buildOwnedMemoryWhere, parseMemoryListFilters } from "@/lib/memory-list-filters";
import { formatMemoryCsv } from "@/lib/memory-export";
import { gateMemoryExport } from "@/lib/memory-export-policy";
import { readMemoryContentPlain } from "@/lib/memory-crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const gate = gateMemoryExport(url.searchParams);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const filters = parseMemoryListFilters({
    q: url.searchParams.get("q") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
    clientId: url.searchParams.get("clientId") ?? undefined,
  });

  const rows = await prisma.memoryItem.findMany({
    where: buildOwnedMemoryWhere(session.user.id, filters),
    orderBy: { updatedAt: "desc" },
    take: 5000,
    include: { client: { select: { companyName: true } } },
  });

  if (!gate.maskSensitive) {
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "memory.export_unmasked",
      entityType: "memory",
      entityId: undefined,
      summary: `Export memoria CSV senza maschera (${rows.length} righe)`,
      metadata: { filters, rowCount: rows.length },
    });
  }

  const csv = formatMemoryCsv(
    rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      title: r.title,
      content: readMemoryContentPlain(r.content, r.contentEncrypted),
      tags: r.tags,
      sensitivity: r.sensitivity,
      source: r.source,
      clientName: r.client?.companyName ?? null,
      updatedAt: r.updatedAt,
    })),
    gate.maskSensitive
  );

  const suffix = gate.maskSensitive ? "" : "-completo";
  const filename = `onizuka-memoria${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
