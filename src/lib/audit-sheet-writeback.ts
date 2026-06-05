import { prisma } from "@/lib/prisma";
import { getGoogleServiceAccountAccessToken } from "@/lib/google-service-account";
import {
  isGoogleSheetsAuditApiConfigured,
  auditSheetRange,
  fetchAuditSheetViaApi,
} from "@/lib/google-sheets-audit";
import {
  normalizeHeader,
  resolveColumnIndexes,
  parseRowFromColumns,
  buildAuditSheetRowKey,
} from "@/lib/audit-sheet-ingest";
import { buildAuditCommercialOutcome } from "@/lib/service-pricing";
import { dateTimeFormatIt } from "@/lib/datetime-it";

const RESULT_HEADERS = [
  "Score",
  "Stato",
  "Servizio primario",
  "Prezzo primario",
  "Secondario 1",
  "Secondario 2",
  "Data audit",
];

/** Indice colonna 0-based → lettera A1 (0→A, 25→Z, 26→AA…). */
function colLetter(n0: number): string {
  let n = n0;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Scrive il risultato dell'audit sul Google Sheet, nelle colonne accanto alla riga
 * del prospect (match per chiave). Idempotente: riusa le colonne risultato se già presenti.
 * Best-effort: richiede service account come Editor + scope spreadsheets.
 */
export async function writeAuditResultToSheet(
  rowKey: string,
  auditId: string
): Promise<{ ok: boolean; reason?: string }> {
  if (!isGoogleSheetsAuditApiConfigured()) return { ok: false, reason: "sheets-not-configured" };
  const spreadsheetId = process.env.GOOGLE_SHEET_AUDIT_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return { ok: false, reason: "no-spreadsheet-id" };

  const token = await getGoogleServiceAccountAccessToken(
    "https://www.googleapis.com/auth/spreadsheets"
  );
  if (!token) return { ok: false, reason: "token" };

  const audit = await prisma.digitalAudit.findUnique({
    where: { id: auditId },
    select: { overallScore: true, sections: { select: { sectionKey: true, score: true } } },
  });
  if (!audit) return { ok: false, reason: "audit-not-found" };

  const outcome = buildAuditCommercialOutcome(audit.sections);
  const dateStr = dateTimeFormatIt({ dateStyle: "short" }).format(new Date());

  const sheetName = (auditSheetRange().split("!")[0] || "Sheet1").trim();
  const sheetRef = `'${sheetName.replace(/'/g, "''")}'`;

  const rows = await fetchAuditSheetViaApi();
  if (!rows.length) return { ok: false, reason: "empty-sheet" };

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(normalizeHeader);
  const indexes = resolveColumnIndexes(headers);

  // Trova la riga del prospect per chiave (stessa logica dell'ingest).
  let targetRow = -1; // 1-based (riga foglio)
  for (let i = 1; i < rows.length; i++) {
    const parsed = parseRowFromColumns(rows[i], i, indexes);
    if ("rejected" in parsed) continue;
    if (buildAuditSheetRowKey(parsed) === rowKey) {
      targetRow = i + 1;
      break;
    }
  }
  if (targetRow < 0) return { ok: false, reason: "row-not-found" };

  // Colonne risultato: riusa se "Score" esiste già, altrimenti appendi dopo i dati.
  const scoreHeaderNorm = normalizeHeader("Score");
  const existingIdx = headers.findIndex((h) => h === scoreHeaderNorm);
  const needHeader = existingIdx < 0;
  const startCol = needHeader ? rawHeaders.length : existingIdx;
  const startLetter = colLetter(startCol);
  const endLetter = colLetter(startCol + RESULT_HEADERS.length - 1);

  const data: { range: string; values: string[][] }[] = [];
  if (needHeader) {
    data.push({ range: `${sheetRef}!${startLetter}1:${endLetter}1`, values: [RESULT_HEADERS] });
  }
  data.push({
    range: `${sheetRef}!${startLetter}${targetRow}:${endLetter}${targetRow}`,
    values: [
      [
        String(audit.overallScore ?? ""),
        "AUDITATO",
        outcome.primaryService,
        outcome.primaryPrice,
        outcome.secondaryServices[0] ?? "",
        outcome.secondaryServices[1] ?? "",
        dateStr,
      ],
    ],
  });

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
    }
  );
  if (!res.ok) {
    console.warn(`[sheet-writeback] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { ok: false, reason: `sheets-write-${res.status}` };
  }
  return { ok: true };
}
