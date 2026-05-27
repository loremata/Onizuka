import type { FinanceEntry } from "@prisma/client";
import { buildCsvFromRows } from "@/lib/csv-utils";
import {
  resolveAccountingAccount,
  resolveCounterpartyAccount,
} from "@/lib/finance-accounting-accounts";

export { resolveAccountingAccount as suggestAccountingAccount } from "@/lib/finance-accounting-accounts";

type AccountingExportRow = FinanceEntry & {
  client?: { companyName: string; accountingCode?: string | null } | null;
};

/** CSV orientato a import contabile (TeamSystem, Zucchetti, Danea, ecc.). */
export function formatFinanceAccountingCsv(rows: AccountingExportRow[]): string {
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  const header = [
    "Data_scadenza",
    "Data_pagamento",
    "Dare_Avere",
    "Importo_EUR",
    "Conto_suggerito",
    "Causale",
    "Cliente",
    "N_fattura",
    "Stato",
    "Tipo",
    "Stripe_session",
    "ID_onizuka",
  ];

  const data = rows.map((e) => {
    const amount = Number(e.amountEur.toString());
    const dareAvere = e.type === "INCOME" ? "AVERE" : "DARE";
    return [
      iso(e.dueDate),
      iso(e.paidAt),
      dareAvere,
      amount.toFixed(2).replace(".", ","),
      resolveAccountingAccount(e.type, e.status, e.client?.accountingCode),
      e.label,
      e.client?.companyName ?? "",
      e.invoiceNumber ?? "",
      e.status,
      e.type === "INCOME" ? "Entrata" : "Uscita",
      e.stripeCheckoutSessionId ?? "",
      e.id,
    ];
  });

  return buildCsvFromRows(header, data);
}

/** Due righe per registrazione (DARE + AVERE) per import gestionale. */
export function formatFinanceDoubleEntryCsv(rows: AccountingExportRow[]): string {
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  const header = [
    "Data",
    "Registrazione_ID",
    "Riga",
    "Conto",
    "Dare_EUR",
    "Avere_EUR",
    "Causale",
    "Cliente",
    "ID_onizuka",
  ];

  const data: string[][] = [];

  for (const e of rows) {
    const amount = Number(e.amountEur.toString()).toFixed(2).replace(".", ",");
    const date = iso(e.paidAt) || iso(e.dueDate) || iso(e.createdAt);
    const main = resolveAccountingAccount(e.type, e.status, e.client?.accountingCode);
    const contra = resolveCounterpartyAccount(e.type, e.status);
    const causale = e.label;
    const cliente = e.client?.companyName ?? "";

    if (e.type === "INCOME") {
      data.push(
        [date, e.id, "1", contra, amount, "", causale, cliente, e.id],
        [date, e.id, "2", main, "", amount, causale, cliente, e.id]
      );
    } else {
      data.push(
        [date, e.id, "1", main, amount, "", causale, cliente, e.id],
        [date, e.id, "2", contra, "", amount, causale, cliente, e.id]
      );
    }
  }

  return buildCsvFromRows(header, data);
}
