import { resolveReachAbVariantForSend } from "@/lib/reach-ab-default";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    outreachDraft: { findFirst: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma") as {
  prisma: {
    user: { findUnique: jest.Mock };
    outreachDraft: { findFirst: jest.Mock };
  };
};

describe("resolveReachAbVariantForSend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ reachAbDefaultVariant: "B" });
    prisma.outreachDraft.findFirst.mockResolvedValue(null);
  });

  it("uses explicit variant when provided", async () => {
    const v = await resolveReachAbVariantForSend("u1", "A");
    expect(v).toBe("A");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("uses owner default when explicit missing", async () => {
    const v = await resolveReachAbVariantForSend("u1", undefined);
    expect(v).toBe("B");
  });

  it("defaults to A when no preference", async () => {
    prisma.user.findUnique.mockResolvedValue({ reachAbDefaultVariant: null });
    const v = await resolveReachAbVariantForSend("u1", "");
    expect(v).toBe("A");
  });
});
