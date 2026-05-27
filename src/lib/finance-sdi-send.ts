import type { FinanceEntry } from "@prisma/client";
import { buildFatturaPaXml } from "@/lib/finance-fatturapa";

export type SdiSendResult = { ok: true } | { ok: false; error: string };

export type FinanceEntrySdiPayload = {
  entry: Pick<
    FinanceEntry,
    "id" | "label" | "invoiceNumber" | "amountEur" | "dueDate" | "paidAt" | "type"
  >;
  clientName: string | null;
  clientVat: string | null;
};

/** Invia XML FatturaPA a bridge SDI configurato (ONIZUKA_SDI_ENDPOINT). */
export async function sendFinanceEntryToSdi(xml: string): Promise<SdiSendResult> {
  const endpoint = process.env.ONIZUKA_SDI_ENDPOINT?.trim();
  if (!endpoint) {
    return { ok: false, error: "ONIZUKA_SDI_ENDPOINT non configurato." };
  }

  const token = process.env.ONIZUKA_SDI_API_KEY?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/xml",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: xml,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text.slice(0, 200) || `SDI bridge HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore rete SDI" };
  }
}

export async function buildAndSendFinanceEntrySdi(payload: FinanceEntrySdiPayload): Promise<SdiSendResult> {
  const xml = buildFatturaPaXml({
    entry: payload.entry,
    clientName: payload.clientName,
    clientVat: payload.clientVat,
    issuerName: process.env.ONIZUKA_ISSUER_NAME?.trim() ?? "Lorenzo Matarazzo",
    issuerVat: process.env.ONIZUKA_ISSUER_VAT?.trim() ?? "",
  });
  return sendFinanceEntryToSdi(xml);
}
