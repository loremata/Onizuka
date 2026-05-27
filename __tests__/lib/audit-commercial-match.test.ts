import {
  normalizeWebsiteDomain,
  prepareAuditCommercialTarget,
} from "@/lib/audit-commercial-match";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    lead: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    digitalAudit: { count: jest.fn() },
  },
}));

jest.mock("@/lib/client-fiscal-identity", () => ({
  findClientByFiscalIdentity: jest.fn(),
}));

jest.mock("@/lib/prospect-vat-pipeline", () => ({
  ensureBusinessClientByVat: jest.fn(),
}));

const { prisma } = jest.requireMock("@/lib/prisma");
const { findClientByFiscalIdentity } = jest.requireMock("@/lib/client-fiscal-identity");
const { ensureBusinessClientByVat } = jest.requireMock("@/lib/prospect-vat-pipeline");

describe("normalizeWebsiteDomain", () => {
  it("strips www and protocol", () => {
    expect(normalizeWebsiteDomain("https://www.Esempio.it/path")).toBe("esempio.it");
    expect(normalizeWebsiteDomain("blog.esempio.it")).toBe("blog.esempio.it");
    expect(normalizeWebsiteDomain("")).toBeNull();
  });
});

describe("prepareAuditCommercialTarget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findClientByFiscalIdentity.mockReset();
    ensureBusinessClientByVat.mockReset();
    prisma.lead.findFirst.mockReset();
    prisma.client.findFirst.mockReset();
    prisma.digitalAudit.count.mockReset();
  });

  it("links audit to existing client by VAT without creating lead duplicate when lead exists", async () => {
    findClientByFiscalIdentity.mockResolvedValue({
      id: "client-1",
      companyName: "Acme Srl",
      vatNumber: "IT12345678901",
    });
    prisma.digitalAudit.count.mockResolvedValue(1);
    prisma.lead.findFirst
      .mockResolvedValueOnce({ id: "lead-1", convertedClientId: null })
      .mockResolvedValueOnce({ id: "lead-1" });

    const result = await prepareAuditCommercialTarget({
      ownerUserId: "u1",
      vatNumber: "IT12345678901",
    });

    expect(result.clientId).toBe("client-1");
    expect(result.leadId).toBe("lead-1");
    expect(result.matchKind).toBe("lead_already_audited");
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("creates new prospect path when VAT is unknown", async () => {
    findClientByFiscalIdentity.mockResolvedValue(null);
    prisma.lead.findFirst.mockImplementation(async () => null);
    prisma.lead.create.mockResolvedValue({ id: "new-lead" });
    ensureBusinessClientByVat.mockResolvedValue({ clientId: "new-client", created: true });
    prisma.client.findUniqueOrThrow.mockResolvedValue({ id: "new-client", companyName: "Prospect P.IVA" });

    const result = await prepareAuditCommercialTarget({
      ownerUserId: "u1",
      vatNumber: "IT99999999999",
    });

    expect(result.matchKind).toBe("new_prospect");
    expect(result.createdClient).toBe(true);
    expect(ensureBusinessClientByVat).toHaveBeenCalled();
  });

  it("matches client by website domain", async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: "c-web",
      companyName: "Web Co",
      website: "https://www.webco.it",
    });
    prisma.lead.findFirst.mockResolvedValue({ id: "lead-web" });

    const result = await prepareAuditCommercialTarget({
      ownerUserId: "u1",
      website: "https://webco.it",
    });

    expect(result.clientId).toBe("c-web");
    expect(result.matchKind).toBe("existing_client");
  });

  it("throws when insufficient identity data", async () => {
    findClientByFiscalIdentity.mockResolvedValue(null);
    await expect(
      prepareAuditCommercialTarget({ ownerUserId: "u1" })
    ).rejects.toThrow(/insufficienti/i);
  });
});
