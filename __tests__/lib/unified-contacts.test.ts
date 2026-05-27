import { listUnifiedContacts } from "@/lib/unified-contacts";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "l1",
          title: "Foo",
          businessName: "Foo Srl",
          contactName: null,
          email: "a@test.it",
          phone: null,
          vatNumber: "IT12345678901",
          status: "NEW",
        },
      ]),
    },
    client: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "c1",
          companyName: "Bar",
          contactEmail: "a@test.it",
          phone: null,
          vatNumber: null,
          status: "ACTIVE_CLIENT",
        },
      ]),
    },
  },
}));

describe("unified-contacts", () => {
  it("segna email duplicata tra lead e client", async () => {
    const rows = await listUnifiedContacts("owner-1");
    const withHint = rows.filter((r) => r.duplicateHints.length > 0);
    expect(withHint.length).toBeGreaterThanOrEqual(2);
  });
});
