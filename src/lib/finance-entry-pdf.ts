import PDFDocument from "pdfkit";
import type { FinanceEntryStatus, FinanceEntryType } from "@prisma/client";

export type FinanceEntryPdfInput = {
  entryId: string;
  label: string;
  type: FinanceEntryType;
  status: FinanceEntryStatus;
  amountEur: string;
  clientName: string | null;
  clientVat: string | null;
  assetName: string | null;
  invoiceNumber: string | null;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
};

const STATUS_IT: Record<FinanceEntryStatus, string> = {
  PLANNED: "Pianificato",
  EXPECTED: "Atteso",
  RECEIVED: "Incassato",
  PAID: "Pagato",
  OVERDUE: "Scaduto",
};

function docTitle(type: FinanceEntryType, status: FinanceEntryStatus): string {
  if (type === "INCOME") {
    if (status === "RECEIVED") return "Ricevuta incasso";
    if (status === "OVERDUE") return "Sollecito incasso";
    return "Promemoria entrata";
  }
  if (status === "PAID") return "Quietanza pagamento";
  return "Nota uscita";
}

export function financeEntryPdfFilename(label: string, entryId: string): string {
  const safe = label
    .slice(0, 40)
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  return `onizuka-finance-${safe || "voce"}-${entryId.slice(0, 8)}.pdf`;
}

export function buildFinanceEntryPdfBuffer(input: FinanceEntryPdfInput): Promise<Buffer> {
  const title = docTitle(input.type, input.status);
  const typeLabel = input.type === "INCOME" ? "Entrata" : "Uscita";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(10).fillColor("#666666").text("Onizuka · Finance");
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor("#000000").text(title);
    doc.moveDown(1);

    doc.fontSize(11).fillColor("#333333");
    doc.text(`Voce: ${input.label}`);
    doc.text(`Tipo: ${typeLabel} · Stato: ${STATUS_IT[input.status]}`);
    if (input.invoiceNumber) doc.text(`Numero: ${input.invoiceNumber}`);
    doc.moveDown(0.6);
    doc.fontSize(14).fillColor("#000000").text(`Importo: € ${input.amountEur}`);

    if (input.clientName) {
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor("#333333");
      doc.text(`Cliente: ${input.clientName}`);
      if (input.clientVat) doc.text(`P.IVA: ${input.clientVat}`);
      if (input.assetName) doc.text(`Asset: ${input.assetName}`);
    }

    doc.moveDown(0.8);
    doc.fontSize(11).fillColor("#333333");
    if (input.dueDate) doc.text(`Scadenza: ${input.dueDate}`);
    if (input.paidAt) doc.text(`Data ${input.type === "INCOME" ? "incasso" : "pagamento"}: ${input.paidAt}`);

    if (input.notes?.trim()) {
      doc.moveDown(1);
      doc.fontSize(11).fillColor("#000000").text("Note");
      doc.fontSize(10).fillColor("#444444").text(input.notes.trim(), { width: 495 });
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999999").text(
      `Ref. ${input.entryId} · Generato ${new Date().toLocaleString("it-IT")} · Onizuka`
    );

    doc.end();
  });
}
