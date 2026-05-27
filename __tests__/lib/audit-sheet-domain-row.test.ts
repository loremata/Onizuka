import { processNonVatSheetQueueItem, ensureSheetFiscalCompletionTask } from "@/lib/audit-sheet-domain-row";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: jest.fn(), create: jest.fn() },
    client: { findFirst: jest.fn(), findMany: jest.fn() },
    flowTask: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock("@/lib/audit-commercial-entry", () => ({
  runDigitalAuditUnified: jest.fn(),
}));

jest.mock("@/lib/audit-sheet-queue-processor-enrich", () => ({
  enrichAuditOutreach: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = jest.requireMock("@/lib/prisma");
const { runDigitalAuditUnified } = jest.requireMock("@/lib/audit-commercial-entry");

describe("processNonVatSheetQueueItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.flowTask.findFirst.mockResolvedValue(null);
    prisma.flowTask.create.mockResolvedValue({ id: "task-1" });
  });

  it("creates lead-only + fiscal task for new domain without match", async () => {
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.lead.create.mockResolvedValue({ id: "lead-new" });

    const result = await processNonVatSheetQueueItem({
      id: "q1",
      ownerUserId: "u1",
      website: "https://www.nuovo.it",
      businessName: "Nuovo Srl",
      city: null,
      contactEmail: null,
    });

    expect(result.status).toBe("SKIPPED");
    expect(result.leadId).toBe("lead-new");
    expect(runDigitalAuditUnified).not.toHaveBeenCalled();
    expect(prisma.lead.create).toHaveBeenCalled();
    expect(prisma.flowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: expect.stringContaining("Completare P.IVA") }),
      })
    );
  });

  it("runs audit when domain matches existing client", async () => {
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.client.findFirst.mockResolvedValue({
      id: "client-1",
      companyName: "Esistente",
      vatNumber: "IT12345678901",
    });
    runDigitalAuditUnified.mockResolvedValue({
      auditId: "audit-1",
      clientId: "client-1",
      leadId: "lead-1",
    });

    const result = await processNonVatSheetQueueItem({
      id: "q1",
      ownerUserId: "u1",
      website: "https://esistente.it",
      businessName: null,
      city: null,
      contactEmail: null,
    });

    expect(result.status).toBe("DONE");
    expect(result.auditId).toBe("audit-1");
    expect(runDigitalAuditUnified).toHaveBeenCalled();
  });
});

describe("ensureSheetFiscalCompletionTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.flowTask.findFirst.mockResolvedValue(null);
    prisma.flowTask.create.mockResolvedValue({ id: "t1" });
  });

  it("dedupes fiscal completion tasks", async () => {
    prisma.flowTask.findFirst.mockResolvedValue({ id: "existing" });
    const id = await ensureSheetFiscalCompletionTask({
      ownerUserId: "u1",
      label: "Test",
      domain: "test.it",
    });
    expect(id).toBeUndefined();
    expect(prisma.flowTask.create).not.toHaveBeenCalled();
  });
});
