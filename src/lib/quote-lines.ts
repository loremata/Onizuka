export type QuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteTotals = {
  subtotal: number;
  tax: number;
  total: number;
};

export function parseQuoteLinesJson(raw: string): QuoteLine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const lines: QuoteLine[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const description = String(o.description ?? "").trim();
    const quantity = Number(o.quantity ?? 1);
    const unitPrice = Number(o.unitPrice ?? 0);
    if (!description) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
    lines.push({ description, quantity, unitPrice });
  }
  return lines;
}

export function computeQuoteTotals(lines: QuoteLine[], taxPercent: number): QuoteTotals {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const tax = subtotal * (Math.max(0, Math.min(100, taxPercent)) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export function formatEur(n: number): string {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
