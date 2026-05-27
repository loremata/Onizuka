import { compare } from "bcryptjs";
import { findAccountsWithDefaultSeedPasswords } from "@/lib/seed-password-check";
import { prisma } from "@/lib/prisma";

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
  },
}));

describe("findAccountsWithDefaultSeedPasswords", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("restituisce email con password seed ancora valida", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { email: "admin@agency.com", passwordHash: "hash1" },
      { email: "client@democlient.com", passwordHash: "hash2" },
    ]);
    (compare as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const weak = await findAccountsWithDefaultSeedPasswords();
    expect(weak).toEqual(["admin@agency.com"]);
  });
});
