import type { MemoryScope, MemorySensitivity, MemorySource } from "@prisma/client";
import { buildCsvFromRows } from "@/lib/csv-utils";

const REDACTED = "[CONTENUTO SENSIBILE — esporta senza mask per admin autorizzato]";

export function maskMemoryContent(
  content: string,
  sensitivity: MemorySensitivity,
  scope: MemoryScope,
  maskSensitive: boolean
): string {
  if (!maskSensitive) return content;
  if (sensitivity === "HIGH" || scope === "SENSITIVE") return REDACTED;
  return content;
}

export type MemoryExportRow = {
  id: string;
  scope: MemoryScope;
  title: string;
  content: string;
  tags: string[];
  sensitivity: MemorySensitivity;
  source: MemorySource;
  clientName: string | null;
  updatedAt: Date;
};

export function parseMaskSensitiveParam(value: string | null): boolean {
  if (value === "0" || value === "false") return false;
  return true;
}

export function formatMemoryCsv(rows: MemoryExportRow[], maskSensitive = true): string {
  const header = [
    "id",
    "scope",
    "title",
    "content",
    "tags",
    "sensitivity",
    "source",
    "cliente",
    "aggiornato",
  ];
  const data = rows.map((r) => [
    r.id,
    r.scope,
    r.title,
    maskMemoryContent(r.content, r.sensitivity, r.scope, maskSensitive),
    r.tags.join("; "),
    r.sensitivity,
    r.source,
    r.clientName ?? "",
    r.updatedAt.toISOString(),
  ]);
  return buildCsvFromRows(header, data);
}
