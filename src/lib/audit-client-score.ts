import type { Client, ClientStatus, Opportunity } from "@prisma/client";

export type AuditClientScore = {
  score: number;
  band: "alta" | "media" | "bassa";
  factors: string[];
};

type ClientWithRelations = Client & {
  _count: { posts: number; assets: number; opportunities: number; contacts: number };
  opportunities: Pick<Opportunity, "status" | "estimatedValue">[];
};

const statusWeight: Partial<Record<ClientStatus, number>> = {
  ACTIVE_CLIENT: 25,
  NEGOTIATION: 20,
  QUOTE_SENT: 18,
  INTERESTED: 15,
  APPOINTMENT_SET: 15,
  CONTACTED: 10,
  LEAD_QUALIFIED: 8,
  DORMANT: -10,
  LOST: -20,
};

export function scoreClientForAudit(client: ClientWithRelations): AuditClientScore {
  let score = 40;
  const factors: string[] = [];

  const sw = statusWeight[client.status] ?? 0;
  score += sw;
  factors.push(`Stato CRM: ${client.status} (${sw >= 0 ? "+" : ""}${sw})`);

  if (client.vatNumber?.trim()) {
    score += 5;
    factors.push("P.IVA presente (+5)");
  }
  if (client.website?.trim()) {
    score += 5;
    factors.push("Sito web (+5)");
  }

  score += Math.min(client._count.assets * 4, 16);
  if (client._count.assets > 0) factors.push(`${client._count.assets} asset (+${Math.min(client._count.assets * 4, 16)})`);

  score += Math.min(client._count.contacts * 3, 9);
  if (client._count.contacts > 0) factors.push(`${client._count.contacts} referenti`);

  const openOpps = client.opportunities.filter((o) => o.status === "OPEN").length;
  score += openOpps * 6;
  if (openOpps) factors.push(`${openOpps} opportunità aperte`);

  const won = client.opportunities.filter((o) => o.status === "WON").length;
  score += won * 8;

  score = Math.max(0, Math.min(100, score));

  const band = score >= 70 ? "alta" : score >= 45 ? "media" : "bassa";
  return { score, band, factors };
}
