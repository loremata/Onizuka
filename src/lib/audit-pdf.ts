import PDFDocument from "pdfkit";
import type { DigitalAuditSectionKey } from "@prisma/client";
import { digitalAuditSectionLabel } from "@/lib/digital-audit-labels";

export type AuditPdfSection = {
  sectionKey: DigitalAuditSectionKey;
  score: number;
  positives: string | null;
  issues: string | null;
};

export type AuditPdfInput = {
  variant: "internal" | "client";
  businessName: string;
  vatNumber: string | null;
  website: string | null;
  overallScore: number;
  priorityProblem: string | null;
  brandName: string | null;
  serviceName: string | null;
  sections: AuditPdfSection[];
  auditId: string;
};

export function auditPdfFilename(businessName: string, auditId: string, variant: "internal" | "client"): string {
  const base = businessName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  return `audit-${variant}-${base || "onizuka"}-${auditId.slice(-6)}.pdf`;
}

export function buildAuditPdfBuffer(input: AuditPdfInput): Promise<Buffer> {
  const isInternal = input.variant === "internal";
  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "long" });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(10).fillColor("#666666").text(`Onizuka · Audit digitale · ${isInternal ? "Interno" : "Cliente"}`);
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor("#000000").text(input.businessName);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#333333");
    if (input.vatNumber) doc.text(`P.IVA: ${input.vatNumber}`);
    if (input.website) doc.text(`Sito: ${input.website}`);
    doc.text(`Data: ${dateFmt.format(new Date())}`);
    doc.moveDown(0.8);

    doc.fontSize(14).fillColor("#000000").text(`Punteggio complessivo: ${input.overallScore}/100`);
    doc.moveDown(0.5);

    if (input.priorityProblem) {
      doc.fontSize(11).fillColor("#333333").text(`Opportunità principale: ${input.priorityProblem}`);
      doc.moveDown(0.3);
    }

    if (isInternal && input.brandName && input.serviceName) {
      doc.text(`Servizio consigliato: ${input.brandName} — ${input.serviceName}`);
      doc.moveDown(0.5);
    } else if (!isInternal && input.serviceName) {
      doc.text(`Consiglio: ${input.serviceName}`);
      doc.moveDown(0.5);
    }

    doc.fontSize(12).fillColor("#000000").text(isInternal ? "Analisi per sezione" : "Aree di miglioramento");
    doc.moveDown(0.4);

    const sorted = [...input.sections].sort((a, b) => a.score - b.score);
    const toShow = isInternal ? sorted : sorted.filter((s) => s.score < 60).slice(0, 4);

    for (const s of toShow.length ? toShow : sorted.slice(0, 4)) {
      const label = digitalAuditSectionLabel[s.sectionKey];
      doc.fontSize(10).fillColor("#000000").text(`${label}: ${s.score}/100`);
      if (s.positives && (isInternal || s.score >= 50)) {
        doc.fontSize(9).fillColor("#22863a").text(`+ ${s.positives}`, { width: 500 });
      }
      if (s.issues) {
        doc.fontSize(9).fillColor(isInternal ? "#b45309" : "#333333").text(`→ ${s.issues}`, { width: 500 });
      }
      doc.moveDown(0.4);
    }

    if (!isInternal) {
      doc.moveDown(0.6);
      doc.fontSize(10).fillColor("#333333").text(
        "Report sintetico Onizuka. Per un confronto operativo senza impegno, rispondi a questa email o prenota una breve call.",
        { width: 500 }
      );
    }

    doc.end();
  });
}
