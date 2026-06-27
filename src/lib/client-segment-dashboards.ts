import { prisma } from "@/lib/prisma";

export type RetailSegment = {
  clients: number;
  contracts: number;
  mrr: number;
  switchDue: number;
};

export type DigitalSegment = {
  clients: number;
  services: number;
  audits: number;
  leads: number;
};

export type ClientSegmentDashboards = {
  retail: RetailSegment;
  digital: DigitalSegment;
};

/** Mini-dashboard per segmento: clienti negozio (telefonia/utenze) e clienti digitali/AI. */
export async function loadClientSegmentDashboards(ownerUserId: string): Promise<ClientSegmentDashboards> {
  const now = new Date();
  const [
    retailClients,
    retailContracts,
    retailMrr,
    retailSwitchDue,
    digitalClients,
    digitalServices,
    digitalAudits,
    digitalLeads,
  ] = await Promise.all([
    prisma.client.count({
      where: { relationshipState: "CLIENTE", clientMacroCategory: { in: ["RETAIL_STORE", "MIXED"] } },
    }),
    prisma.clientRetailContract.count({ where: { status: "ACTIVE" } }),
    prisma.clientRetailContract.aggregate({ where: { status: "ACTIVE" }, _sum: { monthlyEur: true } }),
    prisma.clientRetailContract.count({ where: { status: "ACTIVE", switchReminderAt: { lte: now } } }),
    prisma.client.count({
      where: { relationshipState: "CLIENTE", clientMacroCategory: { in: ["DIGITAL_AI", "MIXED"] } },
    }),
    prisma.clientCommercialService.count({ where: { active: true } }),
    prisma.digitalAudit.count({ where: { ownerUserId, status: "COMPLETED" } }),
    prisma.lead.count({
      where: { ownerUserId, clientMacroCategory: "DIGITAL_AI", status: { in: ["NEW", "CONTACTED", "QUALIFIED", "COLD"] } },
    }),
  ]);

  return {
    retail: {
      clients: retailClients,
      contracts: retailContracts,
      mrr: retailMrr._sum.monthlyEur ? Number(retailMrr._sum.monthlyEur.toString()) : 0,
      switchDue: retailSwitchDue,
    },
    digital: {
      clients: digitalClients,
      services: digitalServices,
      audits: digitalAudits,
      leads: digitalLeads,
    },
  };
}
