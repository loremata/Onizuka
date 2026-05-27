import { importLeadsFromCsv } from "@/lib/lead-csv-import";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { create: jest.fn().mockResolvedValue({ id: "x" }) },
  },
}));

const create = prisma.lead.create as jest.Mock;

describe("lead-csv-import", () => {
  beforeEach(() => create.mockClear());

  it("importa righe valide", async () => {
    const csv = "titolo,email,telefono\nBar Roma,foo@x.it,333\n";
    const r = await importLeadsFromCsv("owner-1", csv);
    expect(r.imported).toBe(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Bar Roma", source: "csv_import" }),
      })
    );
  });

  it("rifiuta CSV senza colonne titolo/azienda", async () => {
    const r = await importLeadsFromCsv("owner-1", "foo,bar\n1,2\n");
    expect(r.imported).toBe(0);
    expect(r.errors[0]).toMatch(/titolo/i);
  });
});
