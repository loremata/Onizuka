import type { Lead, Opportunity } from "@prisma/client";
import { buildCsvFromRows } from "@/lib/csv-utils";
import { leadStatusLabel } from "@/lib/crm-lead-status";
import { opportunityPriorityLabel, opportunityStatusLabel } from "@/lib/crm-opportunity";

export function formatLeadsCsv(
  rows: (Lead & { convertedClient?: { companyName: string } | null })[]
): string {
  const header = [
    "id",
    "titolo",
    "azienda",
    "contatto",
    "email",
    "status",
    "source",
    "converted_client",
    "aggiornato",
  ];
  const data = rows.map((r) => [
    r.id,
    r.title,
    r.businessName ?? "",
    r.contactName ?? "",
    r.email ?? "",
    leadStatusLabel[r.status] ?? r.status,
    r.source ?? "",
    r.convertedClient?.companyName ?? "",
    r.updatedAt.toISOString(),
  ]);
  return buildCsvFromRows(header, data);
}

export function formatOpportunitiesCsv(
  rows: (Opportunity & {
    client: { companyName: string } | null;
    lead?: { businessName: string | null; title: string } | null;
    asset: { name: string } | null;
  })[]
): string {
  const header = [
    "id",
    "titolo",
    "cliente",
    "lead",
    "asset",
    "stato",
    "priorita",
    "valore_stimato",
    "probabilita",
    "next_action",
    "scadenza",
    "aggiornato",
  ];
  const data = rows.map((r) => [
    r.id,
    r.title,
    r.client?.companyName ?? "",
    r.lead?.businessName ?? r.lead?.title ?? "",
    r.asset?.name ?? "",
    opportunityStatusLabel[r.status] ?? r.status,
    opportunityPriorityLabel[r.priority] ?? r.priority,
    r.estimatedValue?.toString() ?? "",
    r.probability?.toString() ?? "",
    r.nextAction ?? "",
    r.dueDate?.toISOString() ?? "",
    r.updatedAt.toISOString(),
  ]);
  return buildCsvFromRows(header, data);
}
