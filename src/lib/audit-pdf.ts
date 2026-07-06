import { existsSync } from "fs";
import path from "path";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import PDFDocument from "pdfkit";
import type { DigitalAuditSectionKey } from "@prisma/client";
import { digitalAuditSectionLabel } from "@/lib/digital-audit-labels";
import type { AuditMetrics } from "@/lib/audit/scoring";

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
  metrics?: AuditMetrics | null;
  auditId: string;
};

/** Brand Online Station (identità verso il cliente). */
const BRAND = {
  name: "Online Station",
  payoff: "Connettività · Energia · Crescita Digitale",
  colors: {
    primary: "#0B1F3A",
    secondary: "#00AEEF",
    accent: "#FF7A00",
    text: "#111827",
    muted: "#6B7280",
    background: "#F5F7FA",
    border: "#E5E7EB",
    success: "#16A34A",
    warning: "#F59E0B",
    danger: "#DC2626",
  },
  footer: {
    address: "Via Aurelia 393, 57016 Rosignano Marittimo (LI)",
    phone: "+39 0586 017 371",
    email: "info@onlinestation.it",
    website: "onlinestation.it",
    vat: "P.IVA IT01851990497",
  },
};

const ASSET_DIR = process.cwd();
const LOGO_PATH = path.join(ASSET_DIR, "public", "brand", "online-station-logo.png");
const FONT_FILES = {
  regular: path.join(ASSET_DIR, "public", "fonts", "Poppins-Regular.ttf"),
  medium: path.join(ASSET_DIR, "public", "fonts", "Poppins-Medium.ttf"),
  semibold: path.join(ASSET_DIR, "public", "fonts", "Poppins-SemiBold.ttf"),
  bold: path.join(ASSET_DIR, "public", "fonts", "Poppins-Bold.ttf"),
};

/** Registra Poppins se i .ttf sono presenti; altrimenti usa Helvetica. Ritorna i nomi font da usare. */
function setupFonts(doc: PDFKit.PDFDocument): { regular: string; medium: string; semibold: string; bold: string } {
  try {
    if (
      existsSync(FONT_FILES.regular) &&
      existsSync(FONT_FILES.bold) &&
      existsSync(FONT_FILES.semibold)
    ) {
      doc.registerFont("OS-Regular", FONT_FILES.regular);
      doc.registerFont("OS-Bold", FONT_FILES.bold);
      doc.registerFont("OS-SemiBold", FONT_FILES.semibold);
      doc.registerFont(
        "OS-Medium",
        existsSync(FONT_FILES.medium) ? FONT_FILES.medium : FONT_FILES.regular
      );
      return { regular: "OS-Regular", medium: "OS-Medium", semibold: "OS-SemiBold", bold: "OS-Bold" };
    }
  } catch {
    /* fallback sotto */
  }
  return { regular: "Helvetica", medium: "Helvetica", semibold: "Helvetica-Bold", bold: "Helvetica-Bold" };
}

function scoreColor(score: number): string {
  if (score < 50) return BRAND.colors.danger;
  if (score < 70) return BRAND.colors.warning;
  return BRAND.colors.success;
}

export function auditPdfFilename(businessName: string, auditId: string, variant: "internal" | "client"): string {
  const base = businessName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  return `audit-${variant}-${base || "online-station"}-${auditId.slice(-6)}.pdf`;
}

export function buildAuditPdfBuffer(input: AuditPdfInput): Promise<Buffer> {
  const isInternal = input.variant === "internal";
  const dateFmt = dateTimeFormatIt({ dateStyle: "long" });
  const c = BRAND.colors;

  return new Promise((resolve, reject) => {
    // bottom margin ampio: riserva la fascia inferiore al footer (il contenuto si ferma sopra).
    const doc = new PDFDocument({ margins: { top: 50, bottom: 95, left: 50, right: 50 }, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const F = setupFonts(doc);
    const pageLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // --- Header: logo (o testo brand) + payoff ---
    let headerBottom = 50;
    try {
      if (existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, pageLeft, 45, { width: 190 });
        headerBottom = 45 + 46;
      } else {
        doc.font(F.bold).fontSize(22).fillColor(c.primary).text(BRAND.name, pageLeft, 48);
        doc.font(F.regular).fontSize(9).fillColor(c.muted).text(BRAND.payoff, pageLeft, 76);
        headerBottom = 92;
      }
    } catch {
      doc.font(F.bold).fontSize(22).fillColor(c.primary).text(BRAND.name, pageLeft, 48);
      headerBottom = 92;
    }

    // Etichetta tipo report a destra
    doc
      .font(F.medium)
      .fontSize(9)
      .fillColor(c.muted)
      .text(isInternal ? "Report interno" : "Analisi presenza online", pageLeft, 52, {
        width: contentWidth,
        align: "right",
      });

    // Linea accento
    const ruleY = Math.max(headerBottom, 96);
    doc.moveTo(pageLeft, ruleY).lineTo(pageLeft + contentWidth, ruleY).lineWidth(2).strokeColor(c.accent).stroke();

    doc.y = ruleY + 18;
    doc.x = pageLeft;

    // --- Titolo + anagrafica ---
    doc.font(F.bold).fontSize(20).fillColor(c.primary).text("Audit della presenza online");
    doc.moveDown(0.2);
    doc.font(F.semibold).fontSize(14).fillColor(c.text).text(input.businessName);
    doc.moveDown(0.2);
    doc.font(F.regular).fontSize(10).fillColor(c.muted);
    const meta: string[] = [];
    if (input.vatNumber) meta.push(`P.IVA: ${input.vatNumber}`);
    if (input.website) meta.push(`Sito: ${input.website}`);
    meta.push(`Data: ${dateFmt.format(new Date())}`);
    doc.text(meta.join("   ·   "));
    doc.moveDown(0.8);

    // --- Box punteggio complessivo ---
    const boxY = doc.y;
    const boxH = 56;
    doc.roundedRect(pageLeft, boxY, contentWidth, boxH, 8).fill(c.background);
    doc.font(F.medium).fontSize(10).fillColor(c.muted).text("Punteggio complessivo", pageLeft + 16, boxY + 12);
    doc.font(F.bold).fontSize(26).fillColor(scoreColor(input.overallScore)).text(
      `${input.overallScore}`,
      pageLeft + 16,
      boxY + 24
    );
    doc.font(F.regular).fontSize(12).fillColor(c.muted).text("/100", pageLeft + 16 + 42, boxY + 35);

    if (input.priorityProblem) {
      doc.font(F.medium).fontSize(10).fillColor(c.text).text("Area prioritaria", pageLeft + 180, boxY + 12);
      doc.font(F.regular).fontSize(11).fillColor(c.text).text(input.priorityProblem, pageLeft + 180, boxY + 26, {
        width: contentWidth - 196,
      });
    }
    doc.y = boxY + boxH + 18;
    doc.x = pageLeft;

    // --- Giudizio Google (PageSpeed): badge punteggi + Core Web Vitals ---
    const psi = input.metrics?.pagespeed ?? null;
    if (psi && (psi.performance != null || psi.seo != null)) {
      doc.font(F.bold).fontSize(12).fillColor(c.primary).text("Il giudizio di Google sul sito (PageSpeed, mobile)");
      doc.moveDown(0.4);
      const psiY = doc.y;
      const gap = 10;
      const boxW = (contentWidth - gap * 3) / 4;
      const psiItems: [string, number | null][] = [
        ["Performance", psi.performance],
        ["SEO", psi.seo],
        ["Accessibilità", psi.accessibility],
        ["Best practices", psi.bestPractices],
      ];
      psiItems.forEach(([lbl, val], i) => {
        const x = pageLeft + i * (boxW + gap);
        doc.roundedRect(x, psiY, boxW, 42, 6).fill(c.background);
        doc
          .font(F.bold)
          .fontSize(19)
          .fillColor(val == null ? c.muted : scoreColor(val))
          .text(val == null ? "n/d" : String(val), x, psiY + 7, { width: boxW, align: "center" });
        doc.font(F.regular).fontSize(7.5).fillColor(c.muted).text(lbl, x, psiY + 30, { width: boxW, align: "center" });
      });
      doc.y = psiY + 50;
      doc.x = pageLeft;
      const cwv: string[] = [];
      if (psi.lcpMs != null) cwv.push(`Caricamento ${(psi.lcpMs / 1000).toFixed(1)}s`);
      if (psi.cls != null) cwv.push(`Stabilità ${psi.cls.toFixed(2)}`);
      if (psi.tbtMs != null) cwv.push(`Reattività ${psi.tbtMs} ms`);
      if (cwv.length) {
        doc.font(F.regular).fontSize(9).fillColor(c.muted).text(`Core Web Vitals:   ${cwv.join("   ·   ")}`, pageLeft, doc.y);
      }
      doc.moveDown(1);
      doc.x = pageLeft;
    }

    // --- Sezioni ---
    doc.font(F.bold).fontSize(13).fillColor(c.primary).text(isInternal ? "Analisi per sezione" : "Aree di miglioramento");
    doc.moveDown(0.5);

    const sorted = [...input.sections].sort((a, b) => a.score - b.score);
    const toShow = isInternal ? sorted : sorted.filter((s) => s.score < 60).slice(0, 4);

    for (const s of toShow.length ? toShow : sorted.slice(0, 4)) {
      // Salto pagina se non c'è spazio per la sezione (evita disegno nella fascia footer).
      if (doc.y > doc.page.height - 150) doc.addPage();
      const label = digitalAuditSectionLabel[s.sectionKey];
      doc.font(F.semibold).fontSize(11).fillColor(c.text).text(`${label}  `, { continued: true });
      doc.font(F.bold).fillColor(scoreColor(s.score)).text(`${s.score}/100`);
      // Barra punteggio (come nel report online).
      const barY = doc.y + 2;
      doc.roundedRect(pageLeft, barY, contentWidth, 4, 2).fill(c.border);
      doc.roundedRect(pageLeft, barY, Math.max(4, contentWidth * (s.score / 100)), 4, 2).fill(scoreColor(s.score));
      doc.y = barY + 9;
      doc.x = pageLeft;
      if (s.positives && (isInternal || s.score >= 50)) {
        doc.font(F.regular).fontSize(9).fillColor(c.success).text(`+ ${s.positives}`, { width: contentWidth });
      }
      if (s.issues) {
        doc.font(F.regular).fontSize(9).fillColor(isInternal ? c.warning : c.muted).text(`→ ${s.issues}`, {
          width: contentWidth,
        });
      }
      doc.moveDown(0.5);
    }

    // --- Consiglio servizio (interno: con brand; cliente: generico) ---
    if (isInternal && input.brandName && input.serviceName) {
      doc.moveDown(0.2);
      doc.font(F.medium).fontSize(10).fillColor(c.secondary).text(
        `Servizio consigliato: ${input.brandName} — ${input.serviceName}`
      );
    }

    // --- CTA cliente ---
    if (!isInternal) {
      doc.moveDown(0.6);
      doc.font(F.regular).fontSize(10).fillColor(c.text).text(
        `${BRAND.name} è il tuo unico referente per connettività, energia e crescita digitale. ` +
          "Per un confronto gratuito sui prossimi passi, rispondi a questa email o prenota una breve call: " +
          "ti mostriamo le priorità e i risultati ottenibili, senza impegno.",
        { width: contentWidth }
      );
    }

    // --- Footer brand (fascia inferiore) ---
    // Azzera il margine inferiore mentre si disegna il footer, altrimenti pdfkit
    // interpreta la scrittura nella fascia bassa come overflow e aggiunge pagine vuote.
    doc.page.margins.bottom = 0;
    const footY = doc.page.height - 72;
    doc.moveTo(pageLeft, footY).lineTo(pageLeft + contentWidth, footY).lineWidth(1).strokeColor(c.border).stroke();
    doc.font(F.semibold).fontSize(9).fillColor(c.primary).text(BRAND.name, pageLeft, footY + 9);
    doc.font(F.regular).fontSize(7.5).fillColor(c.muted).text(
      `${BRAND.footer.address} · ${BRAND.footer.phone} · ${BRAND.footer.email} · ${BRAND.footer.website}`,
      pageLeft,
      footY + 22,
      { width: contentWidth, lineBreak: false }
    );

    doc.end();
  });
}
