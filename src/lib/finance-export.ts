import type { FinanceEntry } from "@prisma/client";
import { buildCsvFromRows } from "@/lib/csv-utils";

const statusLabel: Record<string, string> = {
  PLANNED: "Pianificato",
  EXPECTED: "Atteso",
  RECEIVED: "Incassato",
  PAID: "Pagato",
  OVERDUE: "Scaduto",
};

export function formatFinanceEntriesCsv(
  rows: (FinanceEntry & { client?: { companyName: string } | null })[]
): string {
  const fmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });
  const header = ["Etichetta", "Tipo", "Stato", "Importo EUR", "Cliente", "Scadenza", "Pagato il", "Note"];
  const data = rows.map((e) => [
    e.label,
    e.type === "INCOME" ? "Entrata" : "Uscita",
    statusLabel[e.status] ?? e.status,
    Number(e.amountEur.toString()).toFixed(2),
    e.client?.companyName ?? "",
    e.dueDate ? fmt.format(e.dueDate) : "",
    e.paidAt ? fmt.format(e.paidAt) : "",
    (e.notes ?? "").replace(/\s+/g, " ").slice(0, 200),
  ]);
  return buildCsvFromRows(header, data);
}
