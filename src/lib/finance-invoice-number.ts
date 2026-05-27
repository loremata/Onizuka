import { prisma } from "@/lib/prisma";

/** Genera numero fattura/nota: ONZ-2026-0001 (per owner, anno solare). */
export async function nextFinanceInvoiceNumber(ownerUserId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ONZ-${year}-`;

  const latest = await prisma.financeEntry.findFirst({
    where: {
      ownerUserId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let seq = 1;
  if (latest?.invoiceNumber) {
    const tail = latest.invoiceNumber.slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}
