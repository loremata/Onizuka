import type { TimeEntry } from "@prisma/client";

type Row = TimeEntry & { client: { companyName: string } | null; owner: { email: string } };

function esc(s: string): string {
  const t = s.replace(/"/g, '""');
  return `"${t}"`;
}

/**
 * CSV gestionale stile ERP (separatore `;`, UTF-8 BOM): colonne compatibili con import manuale / bridge contabilità.
 */
export function formatTimeEntriesErpSemicolonCsv(rows: Row[]): string {
  const header = [
    "ownerEmail",
    "workedAt",
    "hours",
    "minutes",
    "billable",
    "hourlyRateEur",
    "lineEurEst",
    "projectCode",
    "clientName",
    "approvedAt",
    "secondApprovedAt",
    "description",
    "entryId",
  ];
  const lines = [header.join(";")];
  for (const r of rows) {
    const hours = (r.minutes / 60).toFixed(2);
    const rate = r.hourlyRateEur != null ? Number(r.hourlyRateEur.toString()) : NaN;
    const lineEst =
      Number.isFinite(rate) ? ((r.minutes / 60) * rate).toFixed(2) : "";
    lines.push(
      [
        esc(r.owner.email),
        esc(r.workedAt.toISOString()),
        hours,
        String(r.minutes),
        r.billable ? "1" : "0",
        r.hourlyRateEur != null ? r.hourlyRateEur.toString() : "",
        lineEst,
        esc((r.projectCode ?? "").replace(/\r?\n/g, " ")),
        esc((r.client?.companyName ?? "").replace(/\r?\n/g, " ")),
        esc(r.approvedAt ? r.approvedAt.toISOString() : ""),
        esc(r.secondApprovedAt ? r.secondApprovedAt.toISOString() : ""),
        esc(r.description.replace(/\r?\n/g, " ")),
        esc(r.id),
      ].join(";")
    );
  }
  return "\uFEFF" + lines.join("\n");
}
