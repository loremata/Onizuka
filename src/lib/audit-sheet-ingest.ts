import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeWebsiteDomain } from "@/lib/audit-commercial-match";

export type AuditSheetRowKind = "vat" | "domain" | "name_city";

export type AuditSheetRow = {
  kind: AuditSheetRowKind;
  vatNumber?: string;
  businessName?: string;
  contactEmail?: string;
  website?: string;
  city?: string;
  rowIndex: number;
};

export type AuditSheetParseResult = {
  rows: AuditSheetRow[];
  rejected: { rowIndex: number; reason: string }[];
};

const VAT_HEADERS = ["piva", "partita_iva", "vat", "vatnumber", "p_iva", "codicefiscale"];
const NAME_HEADERS = ["ragione", "azienda", "business", "company", "nome", "denominazione"];
const EMAIL_HEADERS = ["email", "mail", "e_mail"];
const WEB_HEADERS = ["sito", "website", "url", "web", "dominio"];
const CITY_HEADERS = ["citta", "city", "comune", "localita"];

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeVat(raw: string): string | null {
  const v = raw.replace(/\s/g, "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (v.length < 9) return null;
  return v;
}

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

export function resolveColumnIndexes(headers: string[]) {
  const vatIdx = headers.findIndex((h) =>
    VAT_HEADERS.some((k) => h.includes(k.replace(/_/g, "")) || h === k.replace(/_/g, ""))
  );
  const nameIdx = headers.findIndex((h) => NAME_HEADERS.some((k) => h.includes(k)));
  const emailIdx = headers.findIndex((h) => EMAIL_HEADERS.some((k) => h.includes(k)));
  const webIdx = headers.findIndex((h) => WEB_HEADERS.some((k) => h.includes(k)));
  const cityIdx = headers.findIndex((h) => CITY_HEADERS.some((k) => h.includes(k)));
  return { vatIdx, nameIdx, emailIdx, webIdx, cityIdx };
}

export function parseRowFromColumns(
  cols: string[],
  rowIndex: number,
  indexes: ReturnType<typeof resolveColumnIndexes>
): AuditSheetRow | { rejected: { rowIndex: number; reason: string } } {
  const { vatIdx, nameIdx, emailIdx, webIdx, cityIdx } = indexes;
  const businessName = nameIdx >= 0 ? cols[nameIdx]?.trim() || undefined : undefined;
  const contactEmail = emailIdx >= 0 ? cols[emailIdx]?.trim() || undefined : undefined;
  const websiteRaw = webIdx >= 0 ? cols[webIdx]?.trim() || undefined : undefined;
  const city = cityIdx >= 0 ? cols[cityIdx]?.trim() || undefined : undefined;
  const domain = normalizeWebsiteDomain(websiteRaw);

  if (vatIdx >= 0) {
    const vatNumber = normalizeVat(cols[vatIdx] ?? "");
    if (vatNumber) {
      return {
        kind: "vat",
        vatNumber,
        businessName,
        contactEmail,
        website: websiteRaw,
        city,
        rowIndex,
      };
    }
  }

  if (domain) {
    return {
      kind: "domain",
      website: websiteRaw,
      businessName,
      contactEmail,
      city,
      rowIndex,
    };
  }

  if (businessName && businessName.length >= 3 && city && city.length >= 2) {
    return {
      kind: "name_city",
      businessName,
      contactEmail,
      city,
      rowIndex,
    };
  }

  return {
    rejected: {
      rowIndex,
      reason: "Dati insufficienti: serve P.IVA, dominio valido, oppure ragione sociale e città.",
    },
  };
}

export function parseAuditSheetRows(rows: string[][]): AuditSheetParseResult {
  if (rows.length < 2) return { rows: [], rejected: [] };

  const headers = rows[0].map((c) => normalizeHeader(c ?? ""));
  const indexes = resolveColumnIndexes(headers);
  const hasVat = indexes.vatIdx >= 0;
  const hasWeb = indexes.webIdx >= 0;
  const hasName = indexes.nameIdx >= 0;
  const hasCity = indexes.cityIdx >= 0;

  if (!hasVat && !hasWeb && !(hasName && hasCity)) {
    return { rows: [], rejected: [] };
  }

  const parsed: AuditSheetRow[] = [];
  const rejected: { rowIndex: number; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const result = parseRowFromColumns(rows[i], i, indexes);
    if ("rejected" in result) {
      rejected.push(result.rejected);
      continue;
    }
    parsed.push(result);
  }

  return { rows: parsed, rejected };
}

export function parseAuditSheetCsv(text: string): AuditSheetParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], rejected: [] };

  const rows = lines.map(parseCsvLine);
  return parseAuditSheetRows(rows);
}

export function buildAuditSheetRowKey(row: AuditSheetRow): string {
  if (row.kind === "vat" && row.vatNumber) {
    return createHash("sha256").update(`vat:${row.vatNumber}`).digest("hex").slice(0, 32);
  }
  const domain = normalizeWebsiteDomain(row.website);
  if (row.kind === "domain" && domain) {
    return createHash("sha256").update(`domain:${domain}`).digest("hex").slice(0, 32);
  }
  const name = row.businessName?.trim().toLowerCase() ?? "";
  const city = row.city?.trim().toLowerCase() ?? "";
  return createHash("sha256").update(`namecity:${name}:${city}`).digest("hex").slice(0, 32);
}

export function resolveAuditSheetCsvUrl(): string | null {
  const direct = process.env.GOOGLE_SHEET_AUDIT_CSV_URL?.trim();
  if (direct) return direct;
  const id = process.env.GOOGLE_SHEET_AUDIT_SPREADSHEET_ID?.trim();
  if (!id) return null;
  const gid = process.env.GOOGLE_SHEET_AUDIT_GID?.trim() || "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export async function fetchAuditSheetCsv(): Promise<string> {
  const url = resolveAuditSheetCsvUrl();
  if (!url) throw new Error("Configura GOOGLE_SHEET_AUDIT_CSV_URL o GOOGLE_SHEET_AUDIT_SPREADSHEET_ID.");
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "text/csv" } });
  if (!res.ok) throw new Error(`Sheet non raggiungibile (${res.status}).`);
  return res.text();
}

export async function syncAuditSheetQueue(ownerUserId: string): Promise<{
  parsed: number;
  enqueued: number;
  updated: number;
  skipped: number;
  rejected: { rowIndex: number; reason: string }[];
}> {
  const { fetchAuditSheetForIngest } = await import("@/lib/google-sheets-audit");
  const { rows, rejected: parseRejected } = await fetchAuditSheetForIngest();
  let enqueued = 0;
  let updated = 0;
  let skipped = 0;

  const norm = (v?: string | null) => (v?.trim() || "");

  for (const row of rows) {
    const key = buildAuditSheetRowKey(row);
    const existing = await prisma.auditSheetQueueItem.findUnique({
      where: { ownerUserId_sheetRowKey: { ownerUserId, sheetRowKey: key } },
    });

    if (existing) {
      // Rileva modifiche manuali sul foglio: se un campo è cambiato, ri-accoda per re-audit.
      const changed =
        norm(existing.vatNumber) !== norm(row.vatNumber) ||
        norm(existing.businessName) !== norm(row.businessName) ||
        norm(existing.contactEmail) !== norm(row.contactEmail) ||
        norm(existing.website) !== norm(row.website) ||
        norm(existing.city) !== norm(row.city);

      if (changed) {
        await prisma.auditSheetQueueItem.update({
          where: { id: existing.id },
          data: {
            vatNumber: row.vatNumber ?? null,
            businessName: row.businessName,
            contactEmail: row.contactEmail,
            website: row.website,
            city: row.city,
            status: "PENDING",
            processedAt: null,
            errorDetail: null,
          },
        });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    await prisma.auditSheetQueueItem.create({
      data: {
        ownerUserId,
        vatNumber: row.vatNumber ?? null,
        businessName: row.businessName,
        contactEmail: row.contactEmail,
        website: row.website,
        city: row.city,
        sheetRowKey: key,
        status: "PENDING",
      },
    });
    enqueued++;
  }

  return {
    parsed: rows.length,
    enqueued,
    updated,
    skipped,
    rejected: parseRejected,
  };
}
