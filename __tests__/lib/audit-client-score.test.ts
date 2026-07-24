import { scoreClientForAudit } from "@/lib/audit-client-score";
import type { Client, ClientStatus } from "@prisma/client";

const baseClient = {
  id: "c1",
  companyName: "Test",
  slug: "test",
  contactEmail: "a@b.com",
  status: "ACTIVE_CLIENT" as ClientStatus,
  relationshipState: "CLIENTE" as const,
  kind: null,
  fiscalCode: null,
  clientMacroCategory: null,
  tags: [] as string[],
  isOwnBrand: false,
  vatNumber: "IT123",
  phone: null,
  website: "https://x.com",
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
  _count: { posts: 1, assets: 2, opportunities: 1, contacts: 1 },
  opportunities: [{ status: "OPEN" as const, estimatedValue: null }],
} satisfies Client & {
  _count: { posts: number; assets: number; opportunities: number; contacts: number };
  opportunities: { status: "OPEN"; estimatedValue: null }[];
};

describe("scoreClientForAudit", () => {
  it("returns bounded score and band", () => {
    const r = scoreClientForAudit(baseClient);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(["alta", "media", "bassa"]).toContain(r.band);
    expect(r.factors.length).toBeGreaterThan(0);
  });
});
