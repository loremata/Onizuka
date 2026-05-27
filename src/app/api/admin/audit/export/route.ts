import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadAllAdminAuditForExport, parseAuditDateParam } from "@/lib/admin-audit-log";
import { formatAuditLogCsv } from "@/lib/audit-export";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action")?.trim() || undefined;
  const entityType = url.searchParams.get("entity")?.trim() || undefined;
  const from = parseAuditDateParam(url.searchParams.get("from") ?? undefined);
  const to = parseAuditDateParam(url.searchParams.get("to") ?? undefined, true);
  const actor = url.searchParams.get("actor")?.trim() || undefined;

  const entries = await loadAllAdminAuditForExport({ action, entityType, from, to, actor });
  const csv = formatAuditLogCsv(entries);
  const suffix = action ? `-${action.replace(/\./g, "-")}` : "";
  const filename = `onizuka-audit${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
