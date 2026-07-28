import {
  sweepStaleOutreach,
  checkRecipientCooldown,
  STALE_SCHEDULED_DAYS,
  STALE_PENDING_DRAFT_DAYS,
  RECIPIENT_COOLDOWN_DAYS,
} from "@/lib/outreach-hygiene";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    outreachSequenceStep: { updateMany: jest.fn() },
    outreachDraft: { updateMany: jest.fn(), findFirst: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("@/lib/prisma") as {
  prisma: {
    outreachSequenceStep: { updateMany: jest.Mock };
    outreachDraft: { updateMany: jest.Mock; findFirst: jest.Mock };
  };
};

const NOW = new Date("2026-07-28T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("igiene outreach", () => {
  beforeEach(() => {
    prisma.outreachSequenceStep.updateMany.mockReset();
    prisma.outreachDraft.updateMany.mockReset();
    prisma.outreachDraft.findFirst.mockReset();
  });

  describe("sweepStaleOutreach", () => {
    it("salta gli step programmati oltre la finestra e chiude le bozze vecchie", async () => {
      prisma.outreachSequenceStep.updateMany.mockResolvedValue({ count: 1454 });
      prisma.outreachDraft.updateMany.mockResolvedValue({ count: 510 });

      const res = await sweepStaleOutreach(NOW);
      expect(res).toEqual({ stepsSkipped: 1454, draftsCancelled: 510 });

      const stepWhere = prisma.outreachSequenceStep.updateMany.mock.calls[0][0].where;
      expect(stepWhere.status).toBe("SCHEDULED");
      expect(stepWhere.scheduledFor.lt).toEqual(daysAgo(STALE_SCHEDULED_DAYS));

      const draftWhere = prisma.outreachDraft.updateMany.mock.calls[0][0].where;
      expect(draftWhere.createdAt.lt).toEqual(daysAgo(STALE_PENDING_DRAFT_DAYS));
    });

    it("non tocca gli step ancora futuri né quelli appena scaduti", async () => {
      prisma.outreachSequenceStep.updateMany.mockResolvedValue({ count: 0 });
      prisma.outreachDraft.updateMany.mockResolvedValue({ count: 0 });
      await sweepStaleOutreach(NOW);

      const cutoff: Date = prisma.outreachSequenceStep.updateMany.mock.calls[0][0].where.scheduledFor.lt;
      // Un passo previsto ieri è ancora legittimamente dovuto: il cron
      // potrebbe semplicemente non aver ancora girato.
      expect(daysAgo(1).getTime()).toBeGreaterThan(cutoff.getTime());
      expect(daysAgo(30).getTime()).toBeLessThan(cutoff.getTime());
    });
  });

  describe("checkRecipientCooldown", () => {
    it("lascia passare se quel recapito non è stato contattato di recente", async () => {
      prisma.outreachDraft.findFirst.mockResolvedValue(null);
      expect(await checkRecipientCooldown("info@officina.it", "d1", NOW)).toEqual({ blocked: false });
    });

    it("blocca se lo stesso recapito ha già ricevuto (doppione in anagrafica)", async () => {
      prisma.outreachDraft.findFirst.mockResolvedValue({ sentAt: daysAgo(3) });
      const res = await checkRecipientCooldown("info@officina.it", "d2", NOW);
      expect(res.blocked).toBe(true);
      if (res.blocked) expect(res.reason).toContain("3 giorni fa");
    });

    it("normalizza il recapito e ignora la bozza corrente", async () => {
      prisma.outreachDraft.findFirst.mockResolvedValue(null);
      await checkRecipientCooldown("  INFO@Officina.IT ", "d3", NOW);
      const where = prisma.outreachDraft.findFirst.mock.calls[0][0].where;
      expect(where.sentToEmail).toBe("info@officina.it");
      expect(where.id).toEqual({ not: "d3" });
      expect(where.status).toBe("SENT");
      expect(where.sentAt.gte).toEqual(daysAgo(RECIPIENT_COOLDOWN_DAYS));
    });

    it("recapito vuoto: non è compito suo bloccarlo", async () => {
      expect(await checkRecipientCooldown("   ", "d4", NOW)).toEqual({ blocked: false });
      expect(prisma.outreachDraft.findFirst).not.toHaveBeenCalled();
    });
  });
});
