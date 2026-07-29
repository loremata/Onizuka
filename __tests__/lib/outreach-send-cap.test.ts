import { adviseDailyCap, isAutoSendAllowed, setDailyCap, CAP_TIERS, DEFAULT_CAP } from "@/lib/outreach-send-cap";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    outreachDraft: { count: jest.fn() },
    client: { count: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("@/lib/prisma") as {
  prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    outreachDraft: { count: jest.Mock };
    client: { count: jest.Mock };
  };
};

const NOW = new Date("2026-07-29T15:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

/** sentToday e poi sentLast7 (ordine delle chiamate in adviseDailyCap). */
function mockCounts(opts: { cap?: number | null; raisedAt?: Date | null; today: number; last7: number; optOuts: number }) {
  prisma.user.findUnique.mockResolvedValue({
    reachDailySendCap: opts.cap ?? null,
    reachCapRaisedAt: opts.raisedAt ?? null,
  });
  prisma.outreachDraft.count.mockResolvedValueOnce(opts.today).mockResolvedValueOnce(opts.last7);
  prisma.client.count.mockResolvedValue(opts.optOuts);
}

describe("tetto giornaliero agli invii automatici", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.user.update.mockReset().mockResolvedValue({});
    prisma.outreachDraft.count.mockReset();
    prisma.client.count.mockReset();
  });

  describe("cancello", () => {
    it("lascia passare sotto il tetto", async () => {
      prisma.user.findUnique.mockResolvedValue({ reachDailySendCap: 10 });
      prisma.outreachDraft.count.mockResolvedValue(3);
      expect(await isAutoSendAllowed("u1", NOW)).toEqual({ allowed: true });
    });

    it("blocca a tetto raggiunto e dice che riparte domani", async () => {
      prisma.user.findUnique.mockResolvedValue({ reachDailySendCap: 10 });
      prisma.outreachDraft.count.mockResolvedValue(10);
      const r = await isAutoSendAllowed("u1", NOW);
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toContain("10/10");
    });

    it("senza impostazione parte dal valore prudente", async () => {
      prisma.user.findUnique.mockResolvedValue({ reachDailySendCap: null });
      prisma.outreachDraft.count.mockResolvedValue(DEFAULT_CAP);
      const r = await isAutoSendAllowed("u1", NOW);
      expect(r.allowed).toBe(false);
    });
  });

  describe("consigliere", () => {
    it("le disiscrizioni vengono prima del volume: consiglia di ABBASSARE", async () => {
      mockCounts({ cap: 50, today: 40, last7: 200, optOuts: 8 }); // 4%
      const a = await adviseDailyCap("u1", NOW);
      expect(a.action).toBe("lower");
      expect(a.suggestedCap).toBe(25);
      expect(a.message).toContain("il messaggio");
    });

    it("tetto non sfruttato: alzarlo non servirebbe, e lo dice", async () => {
      mockCounts({ cap: 50, today: 2, last7: 14, optOuts: 0 }); // 2/giorno su 50
      const a = await adviseDailyCap("u1", NOW);
      expect(a.action).toBe("unused");
      expect(a.suggestedCap).toBeNull();
      expect(a.message).toContain("prime mail");
    });

    it("nessun invio: niente da misurare", async () => {
      mockCounts({ cap: 10, today: 0, last7: 0, optOuts: 0 });
      const a = await adviseDailyCap("u1", NOW);
      expect(a.action).toBe("hold");
      expect(a.message).toContain("Nessun invio");
    });

    it("tetto alzato da poco: si aspetta che regga", async () => {
      mockCounts({ cap: 25, today: 20, last7: 160, optOuts: 0, raisedAt: daysAgo(3) });
      const a = await adviseDailyCap("u1", NOW);
      expect(a.action).toBe("hold");
      expect(a.message).toContain("3 giorni fa");
    });

    it("uso pieno, nessuna disiscrizione, soglia assestata: via libera al gradino dopo", async () => {
      mockCounts({ cap: 10, today: 10, last7: 68, optOuts: 0, raisedAt: daysAgo(20) });
      const a = await adviseDailyCap("u1", NOW);
      expect(a.action).toBe("raise");
      expect(a.suggestedCap).toBe(25);
      expect(a.message).toContain("da 10 a 25");
    });

    it("al gradino massimo non inventa numeri più grandi", async () => {
      const max = CAP_TIERS[CAP_TIERS.length - 1];
      mockCounts({ cap: max, today: max, last7: max * 7, optOuts: 0, raisedAt: daysAgo(30) });
      const a = await adviseDailyCap("u1", NOW);
      expect(a.suggestedCap).toBeNull();
      expect(a.message).toContain("dominio");
    });
  });

  describe("applicazione", () => {
    it("alzando registra la data (serve al consigliere)", async () => {
      prisma.user.findUnique.mockResolvedValue({ reachDailySendCap: 10 });
      await setDailyCap("u1", 25);
      expect(prisma.user.update.mock.calls[0][0].data).toHaveProperty("reachCapRaisedAt");
    });

    it("abbassando NON registra la data: è una correzione, non un esperimento", async () => {
      prisma.user.findUnique.mockResolvedValue({ reachDailySendCap: 50 });
      await setDailyCap("u1", 25);
      expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty("reachCapRaisedAt");
    });
  });
});
