import { phoneKey, searchCounterClients, createCounterClient } from "@/lib/inserimenti/counter-client";

jest.mock("@/lib/prisma", () => ({
  prisma: { client: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("@/lib/prisma") as {
  prisma: {
    client: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
};

describe("ponte negozio ↔ CRM", () => {
  beforeEach(() => {
    prisma.client.findMany.mockReset();
    prisma.client.findUnique.mockReset().mockResolvedValue(null);
    prisma.client.create.mockReset();
    prisma.client.update.mockReset().mockResolvedValue({});
  });

  describe("phoneKey", () => {
    it("riconosce lo stesso numero scritto in modi diversi", () => {
      const k = phoneKey("333 123 4567");
      expect(phoneKey("+39 333 1234567")).toBe(k);
      expect(phoneKey("00393331234567")).toBe(k);
      expect(phoneKey("333-123-4567")).toBe(k);
    });

    it("scarta quello che numero non è", () => {
      expect(phoneKey("123")).toBeNull();
      expect(phoneKey("")).toBeNull();
      expect(phoneKey(null)).toBeNull();
    });
  });

  describe("createCounterClient", () => {
    const base = { ownerUserId: "u1", name: "Mario Rossi", phone: "333 1234567" };

    it("riusa il cliente con lo stesso numero invece di duplicarlo", async () => {
      prisma.client.findMany.mockResolvedValue([
        { id: "c1", companyName: "Mario Rossi", phone: "+39 333 1234567", relationshipState: "CLIENTE" },
      ]);
      const res = await createCounterClient(base);
      expect(res).toEqual({ ok: true, id: "c1", companyName: "Mario Rossi", reused: true });
      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it("un prospect che compra diventa cliente", async () => {
      prisma.client.findMany.mockResolvedValue([
        { id: "c2", companyName: "Bar Centrale", phone: "3331234567", relationshipState: "LEAD" },
      ]);
      const res = await createCounterClient(base);
      expect(res).toMatchObject({ ok: true, id: "c2", reused: true });
      expect(prisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "c2" },
          data: { relationshipState: "CLIENTE", status: "ACTIVE_CLIENT" },
        })
      );
    });

    it("crea un cliente vero, con email segnaposto (al banco non si raccoglie)", async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.create.mockResolvedValue({ id: "new1", companyName: "Mario Rossi" });
      const res = await createCounterClient(base);
      expect(res).toMatchObject({ ok: true, id: "new1", reused: false });
      const data = prisma.client.create.mock.calls[0][0].data;
      expect(data.relationshipState).toBe("CLIENTE");
      expect(data.status).toBe("ACTIVE_CLIENT");
      expect(data.contactEmail).toMatch(/@onizuka\.local$/);
      expect(data.phone).toBe("333 1234567");
    });

    it("con email e consenso il cliente nasce raggiungibile (SOFT_OPT_IN)", async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.create.mockResolvedValue({ id: "new2", companyName: "Mario Rossi" });
      const res = await createCounterClient({ ...base, email: " Mario.Rossi@Gmail.com ", marketingOk: true });
      expect(res).toMatchObject({ ok: true, id: "new2" });
      const data = prisma.client.create.mock.calls[0][0].data;
      expect(data.contactEmail).toBe("mario.rossi@gmail.com");
      expect(data.marketingConsentBasis).toBe("SOFT_OPT_IN");
    });

    it("email senza consenso: recapito salvato ma NESSUNA base marketing", async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.create.mockResolvedValue({ id: "new3", companyName: "Mario Rossi" });
      await createCounterClient({ ...base, email: "mario@libero.it", marketingOk: false });
      const data = prisma.client.create.mock.calls[0][0].data;
      expect(data.contactEmail).toBe("mario@libero.it");
      expect(data.marketingConsentBasis).toBeUndefined();
    });

    it("un'email non valida o segnaposto viene ignorata, non blocca la vendita", async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.create.mockResolvedValue({ id: "new4", companyName: "Mario Rossi" });
      const res = await createCounterClient({ ...base, email: "store+abc@onizuka.local", marketingOk: true });
      expect(res).toMatchObject({ ok: true });
      const data = prisma.client.create.mock.calls[0][0].data;
      expect(data.contactEmail).toMatch(/@onizuka\.local$/);
      expect(data.marketingConsentBasis).toBeUndefined();
    });

    it("al riuso, l'email vera rimpiazza il segnaposto ma mai un recapito reale", async () => {
      prisma.client.findMany.mockResolvedValue([
        { id: "c9", companyName: "Bar Centrale", phone: "3331234567", relationshipState: "CLIENTE" },
      ]);
      prisma.client.findUnique.mockResolvedValue({
        contactEmail: "store+123@onizuka.local",
        marketingConsentBasis: "NONE",
      });
      await createCounterClient({ ...base, email: "bar@centrale.it", marketingOk: true });
      expect(prisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "c9" },
          data: { contactEmail: "bar@centrale.it", marketingConsentBasis: "SOFT_OPT_IN" },
        })
      );

      // Recapito reale già presente: non si tocca.
      prisma.client.update.mockClear();
      prisma.client.findUnique.mockResolvedValue({
        contactEmail: "titolare@barcentrale.it",
        marketingConsentBasis: "SOFT_OPT_IN",
      });
      await createCounterClient({ ...base, email: "altro@indirizzo.it", marketingOk: true });
      const dataDelSecondoGiro = prisma.client.update.mock.calls[0]?.[0]?.data ?? {};
      expect(dataDelSecondoGiro.contactEmail).toBeUndefined();
    });

    it("rifiuta nome o telefono insufficienti", async () => {
      expect(await createCounterClient({ ...base, name: "M" })).toEqual({
        ok: false,
        error: "Serve il nome del cliente.",
      });
      expect(await createCounterClient({ ...base, phone: "123" })).toMatchObject({ ok: false });
      expect(prisma.client.create).not.toHaveBeenCalled();
    });
  });

  describe("searchCounterClients", () => {
    it("non interroga il database per un termine troppo corto", async () => {
      expect(await searchCounterClients("a")).toEqual([]);
      expect(prisma.client.findMany).not.toHaveBeenCalled();
    });

    it("trova per telefono anche se a sistema è scritto con prefisso e spazi", async () => {
      prisma.client.findMany.mockResolvedValue([
        { id: "c1", companyName: "Bar Centrale", phone: "+39 333 1234567", relationshipState: "CLIENTE" },
        { id: "c2", companyName: "Altro", phone: "0586 999999", relationshipState: "CLIENTE" },
      ]);
      const hits = await searchCounterClients("3331234567");
      expect(hits.map((h) => h.id)).toEqual(["c1"]);
    });

    it("include i prospect e li marca: entrare in negozio è il momento della conversione", async () => {
      prisma.client.findMany.mockResolvedValue([
        { id: "c3", companyName: "Pizzeria Da Gino", phone: null, relationshipState: "LEAD" },
      ]);
      const hits = await searchCounterClients("pizzeria");
      expect(hits[0]).toMatchObject({ id: "c3", isLead: true });
    });
  });
});
