import { computeClientHealthScore } from "@/lib/client-health-score";
import { Prisma } from "@prisma/client";

const base = {
  id: "c1",
  companyName: "Test",
  slug: "test",
  contactEmail: "a@b.com",
  status: "ACTIVE_CLIENT" as const,
  relationshipState: "CLIENTE" as const,
  kind: null,
  fiscalCode: null,
  clientMacroCategory: null,
  tags: [] as string[],
  isOwnBrand: false,
  vatNumber: null,
  phone: null,
  website: null,
  address: null,
  city: null,
  country: "IT",
  driveFolderUrl: null,
  accountingCode: null,
  dedupeEmbedding: [] as number[],
  ticketSlaHours: null,
  workspaceId: "ws_default",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  opportunities: [{ status: "OPEN" as const, estimatedValue: new Prisma.Decimal(1000) }],
  openTickets: 0,
  overdueFinance: 0,
  overdueFlowTasks: 0,
  _count: {
    posts: 1,
    assets: 2,
    opportunities: 1,
    contacts: 1,
    tickets: 0,
    flowTasks: 0,
  },
};

describe("computeClientHealthScore", () => {
  it("cliente attivo senza alert è in banda healthy", () => {
    const r = computeClientHealthScore(base);
    expect(r.band).toBe("healthy");
    expect(r.score).toBeGreaterThanOrEqual(65);
  });

  it("ticket aperti abbassano lo score", () => {
    const r = computeClientHealthScore({ ...base, openTickets: 3 });
    expect(r.score).toBeLessThan(computeClientHealthScore(base).score);
    expect(r.nextAction).toMatch(/ticket/i);
  });
});
