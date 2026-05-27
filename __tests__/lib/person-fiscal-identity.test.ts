import { assertPersonFiscalUnique, findPersonByFiscalCode } from "@/lib/person-fiscal-identity";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    person: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindFirst = prisma.person.findFirst as jest.Mock;

describe("person-fiscal-identity", () => {
  beforeEach(() => mockFindFirst.mockReset());

  it("findPersonByFiscalCode returns null for empty CF", async () => {
    await expect(findPersonByFiscalCode({ ownerUserId: "u1", fiscalCode: "  " })).resolves.toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("assertPersonFiscalUnique blocks duplicate CF", async () => {
    mockFindFirst.mockResolvedValue({
      id: "p2",
      fullName: "Mario Rossi",
      fiscalCode: "RSSMRA80A01H501U",
    });
    const conflict = await assertPersonFiscalUnique({
      ownerUserId: "u1",
      fiscalCode: "rssmra80a01h501u",
      excludePersonId: "p1",
    });
    expect(conflict?.existingPersonId).toBe("p2");
    expect(conflict?.error).toMatch(/Mario Rossi/);
  });
});
