import type { Client, ClientStatus, Opportunity } from "@prisma/client";

export type ClientHealthScore = {
  score: number;
  band: "healthy" | "watch" | "risk";
  factors: string[];
  nextAction?: string;
};

type Input = Client & {
  _count: {
    posts: number;
    assets: number;
    opportunities: number;
    contacts: number;
    tickets: number;
    flowTasks: number;
  };
  opportunities: Pick<Opportunity, "status" | "estimatedValue">[];
  openTickets: number;
  overdueFinance: number;
  overdueFlowTasks: number;
};

const statusWeight: Partial<Record<ClientStatus, number>> = {
  ACTIVE_CLIENT: 20,
  NEGOTIATION: 15,
  QUOTE_SENT: 12,
  INTERESTED: 10,
  DORMANT: -15,
  LOST: -25,
};

export function computeClientHealthScore(client: Input): ClientHealthScore {
  let score = 50;
  const factors: string[] = [];

  const sw = statusWeight[client.status] ?? 0;
  score += sw;
  factors.push(`Stato: ${client.status} (${sw >= 0 ? "+" : ""}${sw})`);

  if (client.openTickets > 0) {
    const pen = Math.min(client.openTickets * 8, 24);
    score -= pen;
    factors.push(`${client.openTickets} ticket aperti (-${pen})`);
  }
  if (client.overdueFinance > 0) {
    const pen = Math.min(client.overdueFinance * 10, 20);
    score -= pen;
    factors.push(`${client.overdueFinance} voci finance scadute (-${pen})`);
  }
  if (client.overdueFlowTasks > 0) {
    const pen = Math.min(client.overdueFlowTasks * 6, 18);
    score -= pen;
    factors.push(`${client.overdueFlowTasks} task in ritardo (-${pen})`);
  }

  if (client._count.assets > 0) score += Math.min(client._count.assets * 3, 12);
  const openOpps = client.opportunities.filter((o) => o.status === "OPEN").length;
  if (openOpps) score += Math.min(openOpps * 5, 15);

  score = Math.max(0, Math.min(100, score));
  const band = score >= 65 ? "healthy" : score >= 40 ? "watch" : "risk";

  let nextAction: string | undefined;
  if (client.openTickets > 0) nextAction = "Rispondi ai ticket aperti";
  else if (client.overdueFinance > 0) nextAction = "Verifica incassi in Finance";
  else if (client.overdueFlowTasks > 0) nextAction = "Recupera task Flow in ritardo";
  else if (openOpps > 0) nextAction = "Avanza opportunità aperte";

  return { score, band, factors, nextAction };
}
