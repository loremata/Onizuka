import { DEFAULT_ONBOARDING_LABELS, ensureDefaultOnboardingItems } from "@/lib/client-onboarding";

const createMany = jest.fn();
const count = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    clientOnboardingItem: {
      count: (...args: unknown[]) => count(...args),
      createMany: (...args: unknown[]) => createMany(...args),
    },
  },
}));

describe("ensureDefaultOnboardingItems", () => {
  beforeEach(() => {
    createMany.mockClear();
    count.mockClear();
  });

  it("seeds default labels when empty", async () => {
    count.mockResolvedValue(0);
    await ensureDefaultOnboardingItems("c1", "u1");
    expect(createMany).toHaveBeenCalledWith({
      data: DEFAULT_ONBOARDING_LABELS.map((label, i) => ({
        clientId: "c1",
        ownerUserId: "u1",
        label,
        sortOrder: i,
        status: "pending",
      })),
    });
  });

  it("skips when items exist", async () => {
    count.mockResolvedValue(3);
    await ensureDefaultOnboardingItems("c1", "u1");
    expect(createMany).not.toHaveBeenCalled();
  });
});
