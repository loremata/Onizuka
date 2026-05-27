#!/usr/bin/env node
/**
 * Genera PDF slide da docs/presentazione/slides.html (Playwright).
 * Uso: npm run presentazione:pdf
 * Output: docs/presentazione/Onizuka-Presentazione.pdf
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const htmlPath = join(root, "docs/presentazione/slides.html");
const pdfPath = join(root, "docs/presentazione/Onizuka-Presentazione.pdf");

if (!existsSync(htmlPath)) {
  console.error("Manca", htmlPath);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Installa Playwright: npx playwright install chromium");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  landscape: true,
  printBackground: true,
  margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
});
await browser.close();

console.log("PDF generato:", pdfPath);
console.log("Slide HTML:", htmlPath);
console.log("Apri slides.html nel browser → Stampa → PDF se serve rigenerare manualmente.");
