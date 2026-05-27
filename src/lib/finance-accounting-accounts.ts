import type { FinanceEntry } from "@prisma/client";

/** Conti PDC semplificati (default Onizuka). */
export function defaultAccountingAccount(
  type: FinanceEntry["type"],
  status: FinanceEntry["status"]
): string {
  if (type === "INCOME") {
    if (status === "RECEIVED") return process.env.ONIZUKA_FINANCE_INCOME_RECEIVED_ACCOUNT?.trim() || "5810";
    return process.env.ONIZUKA_FINANCE_INCOME_EXPECTED_ACCOUNT?.trim() || "4105";
  }
  if (status === "PAID" || status === "RECEIVED") {
    return process.env.ONIZUKA_FINANCE_EXPENSE_PAID_ACCOUNT?.trim() || "6805";
  }
  return process.env.ONIZUKA_FINANCE_EXPENSE_OPEN_ACCOUNT?.trim() || "2605";
}

export function normalizeClientAccountingCode(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (!/^[0-9A-Za-z]{3,12}$/.test(s)) return null;
  return s;
}

/** Conto export: override cliente → default tipo/stato. */
export function resolveAccountingAccount(
  type: FinanceEntry["type"],
  status: FinanceEntry["status"],
  clientAccountingCode?: string | null
): string {
  const clientCode = normalizeClientAccountingCode(clientAccountingCode);
  if (clientCode) return clientCode;
  return defaultAccountingAccount(type, status);
}

/** Contropartita (banca, crediti, debiti) per export a doppia registrazione. */
export function resolveCounterpartyAccount(
  type: FinanceEntry["type"],
  status: FinanceEntry["status"]
): string {
  if (type === "INCOME") {
    if (status === "RECEIVED") {
      return process.env.ONIZUKA_FINANCE_BANK_ACCOUNT?.trim() || "1801";
    }
    return process.env.ONIZUKA_FINANCE_RECEIVABLE_ACCOUNT?.trim() || "1205";
  }
  if (status === "PAID" || status === "RECEIVED") {
    return process.env.ONIZUKA_FINANCE_BANK_ACCOUNT?.trim() || "1801";
  }
  return process.env.ONIZUKA_FINANCE_PAYABLE_ACCOUNT?.trim() || "2605";
}
