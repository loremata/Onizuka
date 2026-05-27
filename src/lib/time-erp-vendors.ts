import type { TimeEntry } from "@prisma/client";

type Row = TimeEntry & { client: { companyName: string } | null; owner: { email: string } };

function esc(s: string): string {
  const t = s.replace(/"/g, '""');
  return `"${t}"`;
}

function fmtDateIt(d: Date): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(d);
}

import { formatTimeEntriesErpSemicolonCsv } from "@/lib/time-entry-erp-export";
import { formatTimeEntriesSapCsv } from "@/lib/time-erp-sap";

export { formatTimeEntriesErpSemicolonCsv };

/** Layout compatibile import Zucchetti (commessa + ore + importo). */
export function formatTimeEntriesZucchettiCsv(rows: Row[]): string {
  const header = ["Data", "Commessa", "Ore", "Descrizione", "Cliente", "Fatturabile", "ImportoRiga", "Matricola"];
  const lines = [header.join(";")];
  for (const r of rows) {
    const hours = (r.minutes / 60).toFixed(2);
    const rate = r.hourlyRateEur != null ? Number(r.hourlyRateEur.toString()) : NaN;
    const lineEst = Number.isFinite(rate) ? ((r.minutes / 60) * rate).toFixed(2) : "";
    lines.push(
      [
        fmtDateIt(r.workedAt),
        esc((r.projectCode ?? "GEN").replace(/\r?\n/g, " ")),
        hours,
        esc(r.description.replace(/\r?\n/g, " ")),
        esc((r.client?.companyName ?? "").replace(/\r?\n/g, " ")),
        r.billable ? "S" : "N",
        lineEst,
        esc(r.owner.email.split("@")[0] ?? ""),
      ].join(";")
    );
  }
  return "\uFEFF" + lines.join("\n");
}

/** Layout compatibile TeamSystem (codice commessa + quantità ore). */
export function formatTimeEntriesTeamSystemCsv(rows: Row[]): string {
  const header = ["COD_COMMESSA", "DATA", "QTA_ORE", "DESCR", "CLIENTE", "COSTO_ORA", "IMPORTO"];
  const lines = [header.join(";")];
  for (const r of rows) {
    const hours = (r.minutes / 60).toFixed(2);
    const rate = r.hourlyRateEur != null ? Number(r.hourlyRateEur.toString()) : "";
    const lineEst =
      r.hourlyRateEur != null
        ? ((r.minutes / 60) * Number(r.hourlyRateEur.toString())).toFixed(2)
        : "";
    lines.push(
      [
        esc((r.projectCode ?? "").replace(/\r?\n/g, " ")),
        fmtDateIt(r.workedAt),
        hours,
        esc(r.description.slice(0, 80).replace(/\r?\n/g, " ")),
        esc((r.client?.companyName ?? "").replace(/\r?\n/g, " ")),
        rate,
        lineEst,
      ].join(";")
    );
  }
  return "\uFEFF" + lines.join("\n");
}

export type ErpVendor = "generic" | "zucchetti" | "teamsystem" | "sap";

export function formatTimeEntriesForErpVendor(rows: Row[], vendor: ErpVendor): string {
  switch (vendor) {
    case "zucchetti":
      return formatTimeEntriesZucchettiCsv(rows);
    case "teamsystem":
      return formatTimeEntriesTeamSystemCsv(rows);
    case "sap":
      return formatTimeEntriesSapCsv(rows);
    default:
      return formatTimeEntriesErpSemicolonCsv(rows);
  }
}
