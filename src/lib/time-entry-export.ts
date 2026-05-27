import type { TimeEntry } from "@prisma/client";

type Row = TimeEntry & { client: { companyName: string } | null };

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function estimatedLineEur(r: Row): string {
  if (r.hourlyRateEur == null) return "";
  const rate = Number(r.hourlyRateEur.toString());
  if (!Number.isFinite(rate)) return "";
  return ((r.minutes / 60) * rate).toFixed(2);
}

export function formatTimeEntriesCsv(rows: Row[]): string {
  const header = [
    "workedAt",
    "minutes",
    "billable",
    "hourlyRateEur",
    "lineEurEst",
    "projectCode",
    "approvedAt",
    "secondApprovedAt",
    "description",
    "client",
    "createdAt",
    "id",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const workedAt = r.workedAt.toISOString();
    const createdAt = r.createdAt.toISOString();
    const client = r.client?.companyName ?? "";
    const approvedAt = r.approvedAt ? r.approvedAt.toISOString() : "";
    const secondApprovedAt = r.secondApprovedAt ? r.secondApprovedAt.toISOString() : "";
    const rateStr = r.hourlyRateEur != null ? r.hourlyRateEur.toString() : "";
    const lineEst = estimatedLineEur(r);
    const project = r.projectCode ?? "";
    lines.push(
      [
        csvEscape(workedAt),
        String(r.minutes),
        r.billable ? "true" : "false",
        rateStr,
        lineEst,
        csvEscape(project.replace(/\r?\n/g, " ")),
        csvEscape(approvedAt),
        csvEscape(secondApprovedAt),
        csvEscape(r.description.replace(/\r?\n/g, " ")),
        csvEscape(client),
        csvEscape(createdAt),
        csvEscape(r.id),
      ].join(",")
    );
  }
  return "\uFEFF" + lines.join("\n");
}
