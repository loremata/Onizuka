import { getGoogleServiceAccountAccessToken, isGoogleServiceAccountConfigured } from "@/lib/google-service-account";
import { parseAuditSheetRows, type AuditSheetParseResult } from "@/lib/audit-sheet-ingest";

export function isGoogleSheetsAuditApiConfigured(): boolean {
  return (
    isGoogleServiceAccountConfigured() && !!process.env.GOOGLE_SHEET_AUDIT_SPREADSHEET_ID?.trim()
  );
}

export function auditSheetRange(): string {
  return process.env.GOOGLE_SHEET_AUDIT_RANGE?.trim() || "Sheet1!A:Z";
}

export async function fetchAuditSheetViaApi(): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_AUDIT_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_AUDIT_SPREADSHEET_ID mancante.");

  const token = await getGoogleServiceAccountAccessToken(
    "https://www.googleapis.com/auth/spreadsheets.readonly"
  );
  if (!token) throw new Error("Service account Google non configurato o token negato.");

  const range = encodeURIComponent(auditSheetRange());
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = (await res.json()) as { values?: string[][] };
  return json.values ?? [];
}

export async function fetchAuditSheetForIngest(): Promise<AuditSheetParseResult> {
  if (isGoogleSheetsAuditApiConfigured()) {
    const rows = await fetchAuditSheetViaApi();
    return parseAuditSheetRows(rows);
  }
  const { fetchAuditSheetCsv, parseAuditSheetCsv } = await import("@/lib/audit-sheet-ingest");
  const csv = await fetchAuditSheetCsv();
  return parseAuditSheetCsv(csv);
}
