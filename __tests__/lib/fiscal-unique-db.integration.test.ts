/**
 * Integrazione DB locale: indici UNIQUE fiscali (solo con DATABASE_URL).
 * Non eseguito in CI senza DB — usa `npm test -- fiscal-unique-db`.
 *
 * @jest-environment node
 */
import { PrismaClient } from "@prisma/client";
import { normalizeFiscalCode, normalizeVatNumber } from "@/lib/fiscal-normalize";

const runIntegration = Boolean(process.env.DATABASE_URL?.trim());

const describeDb = runIntegration ? describe : describe.skip;

describeDb("fiscal UNIQUE indexes (local DB integration)", () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);
  const vatBase = `IT9${suffix.replace(/\D/g, "").slice(0, 10).padEnd(10, "0")}`.slice(0, 13);
  const cfBase = `TST${suffix.toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(13, "X")}`.slice(0, 16);

  const createdClientIds: string[] = [];
  const createdPersonIds: string[] = [];
  let ownerUserId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (!admin) throw new Error("Nessun utente ADMIN nel DB locale.");
    ownerUserId = admin.id;
  });

  afterAll(async () => {
    for (const id of createdPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdClientIds) {
      await prisma.client.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createTestClient(data: {
    slug: string;
    vatNumber?: string | null;
    fiscalCode?: string | null;
  }) {
    const c = await prisma.client.create({
      data: {
        companyName: `Fiscal test ${data.slug}`,
        slug: data.slug,
        contactEmail: `${data.slug}@fiscal-test.onizuka.local`,
        vatNumber: data.vatNumber ?? null,
        fiscalCode: data.fiscalCode ?? null,
        kind: data.vatNumber ? "BUSINESS" : "PRIVATE",
      },
    });
    createdClientIds.push(c.id);
    return c;
  }

  it("blocks second Client with same normalized VAT", async () => {
    const vat = vatBase;
    await createTestClient({ slug: `fvat-a-${suffix}`, vatNumber: vat });
    await expect(
      createTestClient({ slug: `fvat-b-${suffix}`, vatNumber: ` ${vat.toLowerCase()} ` })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("blocks second Client with same normalized fiscal code", async () => {
    const cf = cfBase;
    await createTestClient({ slug: `fcf-a-${suffix}`, fiscalCode: cf });
    await expect(
      createTestClient({ slug: `fcf-b-${suffix}`, fiscalCode: ` ${cf.toLowerCase()} ` })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows multiple Clients with null VAT", async () => {
    await createTestClient({ slug: `vnull-a-${suffix}`, vatNumber: null });
    await createTestClient({ slug: `vnull-b-${suffix}`, vatNumber: null });
  });

  it("allows multiple Clients with empty-string VAT treated as null in app only — DB may store empty", async () => {
    const c1 = await createTestClient({ slug: `vempty-a-${suffix}`, vatNumber: null });
    expect(c1.vatNumber).toBeNull();
  });

  it("blocks second Person with same CF for same owner", async () => {
    const cf = `PRS${suffix.toUpperCase().slice(0, 13).padEnd(13, "Y")}`.slice(0, 16);
    const p1 = await prisma.person.create({
      data: { ownerUserId, fullName: "Test Person A", fiscalCode: cf },
    });
    createdPersonIds.push(p1.id);
    await expect(
      prisma.person.create({
        data: {
          ownerUserId,
          fullName: "Test Person B",
          fiscalCode: normalizeFiscalCode(` ${cf} `),
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows multiple Person without fiscal code", async () => {
    const p1 = await prisma.person.create({
      data: { ownerUserId, fullName: `No CF A ${suffix}` },
    });
    const p2 = await prisma.person.create({
      data: { ownerUserId, fullName: `No CF B ${suffix}` },
    });
    createdPersonIds.push(p1.id, p2.id);
  });

  it("ensureBusinessClientByVat is idempotent", async () => {
    const { ensureBusinessClientByVat } = await import("@/lib/prospect-vat-pipeline");
    const vat = `IT8${suffix.replace(/\D/g, "").slice(0, 10).padEnd(10, "1")}`.slice(0, 13);
    const a = await ensureBusinessClientByVat({ vatNumber: vat });
    const b = await ensureBusinessClientByVat({ vatNumber: ` ${vat} ` });
    expect(b.clientId).toBe(a.clientId);
    createdClientIds.push(a.clientId);
  });
});
