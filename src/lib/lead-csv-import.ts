import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeVatNumber } from "@/lib/fiscal-normalize";

const VALID_STATUS = new Set<LeadStatus>(["NEW", "COLD", "QUALIFIED", "CONTACTED", "CONVERTED", "LOST"]);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if ((c === "," || c === ";") && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function importLeadsFromCsv(
  ownerUserId: string,
  csvText: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: ["CSV vuoto o senza righe dati."] };

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const titleIdx = headers.findIndex((h) => h.includes("titolo") || h === "title");
  const bizIdx = headers.findIndex((h) => h.includes("azienda") || h.includes("business"));
  const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
  const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("telefono"));
  const vatIdx = headers.findIndex((h) => h.includes("piva") || h.includes("vat"));
  const sourceIdx = headers.findIndex((h) => h.includes("source") || h.includes("origine"));
  const statusIdx = headers.findIndex((h) => h.includes("status") || h.includes("stato"));

  if (titleIdx < 0 && bizIdx < 0) {
    return { imported: 0, skipped: 0, errors: ["Colonna titolo o azienda richiesta."] };
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const title =
      (titleIdx >= 0 ? cols[titleIdx] : "") || (bizIdx >= 0 ? cols[bizIdx] : "") || "";
    if (!title.trim()) {
      skipped++;
      continue;
    }
    const statusRaw = (statusIdx >= 0 ? cols[statusIdx] : "NEW").toUpperCase();
    const status = VALID_STATUS.has(statusRaw as LeadStatus) ? (statusRaw as LeadStatus) : "NEW";

    try {
      await prisma.lead.create({
        data: {
          ownerUserId,
          title: title.trim(),
          businessName: bizIdx >= 0 ? cols[bizIdx]?.trim() || undefined : undefined,
          email: emailIdx >= 0 ? cols[emailIdx]?.trim() || undefined : undefined,
          phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() || undefined : undefined,
          vatNumber:
            vatIdx >= 0 ? normalizeVatNumber(cols[vatIdx]?.trim()) ?? undefined : undefined,
          source: sourceIdx >= 0 ? cols[sourceIdx]?.trim() || "csv_import" : "csv_import",
          status,
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Riga ${i + 1}: ${e instanceof Error ? e.message : "errore"}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}
