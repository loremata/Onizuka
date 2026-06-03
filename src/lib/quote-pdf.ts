import { dateTimeFormatIt } from "@/lib/datetime-it";
import PDFDocument from "pdfkit";
import { computeQuoteTotals, formatEur, parseQuoteLinesJson, type QuoteLine } from "@/lib/quote-lines";

export type QuotePdfInput = {
  title: string;
  clientName: string;
  vatNumber: string | null;
  opportunityTitle: string;
  statusLabel: string;
  linesJson: string;
  taxPercent: number;
  notes: string | null;
  validUntil: Date | null;
  quoteId: string;
};

export function quotePdfFilename(title: string, quoteId: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = quoteId.slice(-6);
  return `preventivo-${base || "onizuka"}-${suffix}.pdf`;
}

function drawLinesTable(doc: InstanceType<typeof PDFDocument>, lines: QuoteLine[], startY: number): number {
  const colDesc = 50;
  const colQty = 340;
  const colPrice = 400;
  const colAmount = 480;
  let y = startY;

  doc.fontSize(9).fillColor("#666666");
  doc.text("Descrizione", colDesc, y);
  doc.text("Q.tà", colQty, y, { width: 50, align: "right" });
  doc.text("Prezzo", colPrice, y, { width: 70, align: "right" });
  doc.text("Importo", colAmount, y, { width: 70, align: "right" });
  y += 14;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#dddddd").stroke();
  y += 8;

  doc.fillColor("#000000").fontSize(10);
  for (const line of lines) {
    const amount = line.quantity * line.unitPrice;
    const descHeight = doc.heightOfString(line.description, { width: 270 });
    doc.text(line.description, colDesc, y, { width: 270 });
    doc.text(String(line.quantity), colQty, y, { width: 50, align: "right" });
    doc.text(formatEur(line.unitPrice), colPrice, y, { width: 70, align: "right" });
    doc.text(formatEur(amount), colAmount, y, { width: 70, align: "right" });
    y += Math.max(descHeight, 14) + 6;
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  }
  return y + 8;
}

export function buildQuotePdfBuffer(input: QuotePdfInput): Promise<Buffer> {
  const lines = parseQuoteLinesJson(input.linesJson);
  const totals = computeQuoteTotals(lines, input.taxPercent);
  const dateFmt = dateTimeFormatIt({ dateStyle: "long" });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(10).fillColor("#666666").text("Onizuka · Preventivo", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor("#000000").text(input.title, { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333333");
    doc.text(`Cliente: ${input.clientName}`);
    if (input.vatNumber) doc.text(`P.IVA: ${input.vatNumber}`);
    doc.text(`Opportunità: ${input.opportunityTitle}`);
    doc.text(`Stato: ${input.statusLabel}`);
    if (input.validUntil) doc.text(`Valido fino al: ${dateFmt.format(input.validUntil)}`);
    doc.moveDown(1);

    const afterTable = drawLinesTable(doc, lines, doc.y);

    let y = afterTable;
    const totalsX = 380;
    doc.fontSize(10).fillColor("#333333");
    doc.text(`Imponibile: ${formatEur(totals.subtotal)}`, totalsX, y, { align: "right", width: 165 });
    y += 16;
    doc.text(`IVA (${input.taxPercent}%): ${formatEur(totals.tax)}`, totalsX, y, { align: "right", width: 165 });
    y += 18;
    doc.fontSize(12).fillColor("#000000").text(`Totale: ${formatEur(totals.total)}`, totalsX, y, {
      align: "right",
      width: 165,
    });

    if (input.notes?.trim()) {
      y += 36;
      doc.fontSize(11).fillColor("#000000").text("Note", 50, y);
      doc.fontSize(10).fillColor("#444444").text(input.notes.trim(), 50, y + 16, { width: 495 });
    }

    doc.fontSize(8).fillColor("#999999").text(`Ref. ${input.quoteId}`, 50, 780, { align: "left" });

    doc.end();
  });
}
