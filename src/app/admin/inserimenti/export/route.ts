import { NextRequest, NextResponse } from "next/server";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

/**
 * Export CSV delle vendite di un mese. Separatore ";" e BOM UTF-8 così Excel
 * italiano lo apre correttamente senza passaggi manuali.
 * GET /admin/inserimenti/export?mese=2026-07
 */
export async function GET(req: NextRequest) {
  const session = await requireFullAdmin();
  const mese = req.nextUrl.searchParams.get("mese") ?? "";
  const month = /^\d{4}-\d{2}$/.test(mese) ? mese : new Date().toISOString().slice(0, 7);

  const sales = await prisma.storeSale.findMany({
    where: { ownerUserId: session.user.id, month },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const head = [
    "Data",
    "Brand",
    "Pista",
    "Codice offerta",
    "Canone EUR",
    "Fonte canone",
    "Domiciliato",
    "Provenienza",
    "Sottotipo",
    "Note",
  ].join(";");

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = sales.map((s) =>
    [
      s.date.toISOString().slice(0, 10),
      s.brand,
      s.lineKey,
      s.offerCode ?? "",
      s.feeEur == null ? "" : String(s.feeEur).replace(".", ","),
      s.feeSource,
      s.domiciled ? "SI" : "NO",
      s.provenance ?? "",
      s.subtype ?? "",
      s.notes ?? "",
    ]
      .map(esc)
      .join(";"),
  );

  const csv = "﻿" + [head, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inserimenti_${month}.csv"`,
    },
  });
}
