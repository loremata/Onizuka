import { ITALY_TZ } from "@/lib/datetime-it";
import PDFDocument from "pdfkit";
import type { FinanceLedgerStats } from "@/lib/finance-ledger-stats";
import { FINANCE_MONTHLY_TARGET_EUR } from "@/lib/finance-ledger-stats";

export type FinanceSummaryPdfInput = {
  monthLabel: string;
  ledger: FinanceLedgerStats;
  pipelineOpenEur: string;
  pipelineWeightedEur: string;
  overdueRows: { label: string; amountEur: string; clientName: string | null; dueDate: string }[];
};

export function financeSummaryPdfFilename(monthLabel: string): string {
  const safe = monthLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `onizuka-finance-${safe || "report"}.pdf`;
}

export function buildFinanceSummaryPdfBuffer(input: FinanceSummaryPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(10).fillColor("#666666").text("Onizuka · Finance · Report mensile");
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor("#000000").text(`Cashflow · ${input.monthLabel}`);
    doc.moveDown(1);

    const l = input.ledger;
    doc.fontSize(11).fillColor("#333333");
    doc.text(`Target mensile: € ${FINANCE_MONTHLY_TARGET_EUR.toLocaleString("it-IT")}`);
    doc.moveDown(0.8);
    doc.text(`Netto forecast mese: € ${l.monthNetForecastEur}`);
    doc.text(`Gap vs target: € ${l.gapToTargetEur}`);
    doc.moveDown(0.5);
    doc.text(`Entrate attese: € ${l.monthIncomeExpectedEur} · Incassate: € ${l.monthIncomeReceivedEur}`);
    doc.text(`Uscite attese: € ${l.monthExpenseExpectedEur} · Pagate: € ${l.monthExpensePaidEur}`);
    doc.text(`Voci nel mese: ${l.entryCount} · Scadute: ${l.overdueCount}`);
    doc.moveDown(0.8);
    doc.text(`Pipeline aperta: € ${input.pipelineOpenEur} (pesata € ${input.pipelineWeightedEur})`);

    if (input.overdueRows.length > 0) {
      doc.moveDown(1.2);
      doc.fontSize(13).fillColor("#000000").text("Incassi / pagamenti scaduti");
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor("#333333");
      for (const row of input.overdueRows.slice(0, 15)) {
        doc.text(
          `• ${row.label} — € ${row.amountEur}${row.clientName ? ` (${row.clientName})` : ""}${row.dueDate ? ` · scad. ${row.dueDate}` : ""}`
        );
      }
      if (input.overdueRows.length > 15) {
        doc.text(`… e altre ${input.overdueRows.length - 15} voci`);
      }
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999999").text(`Generato ${new Date().toLocaleString("it-IT", { timeZone: ITALY_TZ })} · Onizuka`);

    doc.end();
  });
}
