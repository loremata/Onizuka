import { processAuditSheetQueueBatch } from "@/lib/audit-sheet-queue-processor";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditSheetQueueItem: { findMany: jest.fn(), update: jest.fn() },
    digitalAudit: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("@/lib/audit-commercial-entry", () => ({
  runDigitalAuditUnified: jest.fn(),
}));

jest.mock("@/lib/public-report-token", () => ({
  ensureDigitalAuditPublicReportToken: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = jest.requireMock("@/lib/prisma");
const { runDigitalAuditUnified } = jest.requireMock("@/lib/audit-commercial-entry");

describe("processAuditSheetQueueBatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditSheetQueueItem.findMany.mockResolvedValue([
      {
        id: "q1",
        ownerUserId: "u1",
        vatNumber: "IT12345678901",
        businessName: "Acme",
        contactEmail: "a@acme.it",
        website: "https://acme.it",
      },
    ]);
    prisma.auditSheetQueueItem.update.mockResolvedValue({});
    runDigitalAuditUnified.mockResolvedValue({
      auditId: "audit-1",
      clientId: "client-1",
      leadId: "lead-1",
    });
    prisma.digitalAudit.findUnique.mockResolvedValue({
      ownerUserId: "u1",
      businessName: "Acme",
      overallScore: 50,
      priorityProblem: null,
      sections: [],
      recommendedBrand: null,
      recommendedService: null,
      client: { companyName: "Acme" },
    });
  });

  it("uses unified commercial entry for sheet rows", async () => {
    const result = await processAuditSheetQueueBatch(1);
    expect(result.done).toBe(1);
    expect(result.skipped).toBe(0);
    expect(runDigitalAuditUnified).toHaveBeenCalledWith(
      expect.objectContaining({
        vatNumber: "IT12345678901",
        acquisitionSource: "sheet_queue",
        website: "https://acme.it",
      })
    );
  });
});
