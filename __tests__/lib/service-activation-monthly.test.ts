import { getServiceActivationMonthlyReport } from "@/lib/service-activation-monthly";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    commercialService: {
      findMany: jest.fn().mockResolvedValue([
        { id: "s1", name: "Social base", category: "SOCIAL", ecosystemBrand: { name: "LabSeven" } },
      ]),
    },
    clientCommercialService: {
      findMany: jest.fn().mockResolvedValue([
        {
          commercialServiceId: "s1",
          commercialService: { name: "Social base", category: "SOCIAL", ecosystemBrand: { name: "LabSeven" } },
        },
      ]),
    },
  },
}));

describe("service-activation-monthly", () => {
  it("conta attivazioni per servizio", async () => {
    const r = await getServiceActivationMonthlyReport("owner-1", 2026, 5);
    expect(r.cards[0].total).toBe(1);
    expect(r.cards[0].serviceName).toBe("Social base");
  });
});
