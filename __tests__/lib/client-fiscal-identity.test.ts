import { normalizeFiscalCode, normalizeVatNumber } from "@/lib/client-kind";
import { assertLeadVatClientLink, findClientByFiscalIdentity } from "@/lib/client-fiscal-identity";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = prisma.client.findUnique as jest.Mock;
const mockFindFirst = prisma.client.findFirst as jest.Mock;

describe("client fiscal identity normalization", () => {
  it("normalizes VAT (strip spaces, uppercase)", () => {
    expect(normalizeVatNumber(" it 12345678901 ")).toBe("IT12345678901");
    expect(normalizeVatNumber("")).toBeNull();
    expect(normalizeVatNumber(null)).toBeNull();
  });

  it("normalizes fiscal code (strip spaces, uppercase)", () => {
    expect(normalizeFiscalCode(" rssmra80a01h501u ")).toBe("RSSMRA80A01H501U");
    expect(normalizeFiscalCode("")).toBeNull();
  });
});

describe("assertLeadVatClientLink", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
  });

  it("skips when no convertedClientId", async () => {
    await expect(assertLeadVatClientLink({ vatNumber: "IT12345678901" })).resolves.toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rejects when lead VAT differs from linked client VAT", async () => {
    mockFindUnique.mockResolvedValue({
      id: "c1",
      companyName: "Acme",
      vatNumber: "IT11111111111",
    });
    const result = await assertLeadVatClientLink({
      vatNumber: "IT22222222222",
      convertedClientId: "c1",
    });
    expect(result?.error).toMatch(/non coincide/);
  });

  it("rejects when lead VAT belongs to another client", async () => {
    mockFindUnique.mockResolvedValue({
      id: "c1",
      companyName: "Acme",
      vatNumber: "IT12345678901",
    });
    mockFindFirst.mockResolvedValue({
      id: "c2",
      companyName: "Beta Srl",
      vatNumber: "IT12345678901",
      fiscalCode: null,
    });
    const result = await assertLeadVatClientLink({
      vatNumber: "IT12345678901",
      convertedClientId: "c1",
    });
    expect(result?.error).toMatch(/Beta Srl/);
    expect(result?.existingClientId).toBe("c2");
  });
});

describe("findClientByFiscalIdentity", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  it("queries normalized VAT", async () => {
    mockFindFirst.mockResolvedValue(null);
    await findClientByFiscalIdentity({ vatNumber: " it 12345678901 " });
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { vatNumber: { equals: "IT12345678901", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });
});
