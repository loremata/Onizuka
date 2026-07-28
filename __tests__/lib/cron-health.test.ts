import { loadCronHealth, cronProblemLine } from "@/lib/cron-health";
import { CRON_EXPECTATIONS } from "@/lib/cron-run";

jest.mock("@/lib/prisma", () => ({
  prisma: { cronRun: { findMany: jest.fn() } },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("@/lib/prisma") as { prisma: { cronRun: { findMany: jest.Mock } } };

const NOW = new Date("2026-07-29T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

/** lastRuns, lastOks, stuckRuns nell'ordine in cui loadCronHealth li chiede. */
function mockRuns(lastRuns: unknown[], lastOks: unknown[], stuck: unknown[] = []) {
  prisma.cronRun.findMany
    .mockResolvedValueOnce(lastRuns)
    .mockResolvedValueOnce(lastOks)
    .mockResolvedValueOnce(stuck);
}

describe("salute lavori notturni", () => {
  beforeEach(() => prisma.cronRun.findMany.mockReset());

  it("nessun run registrato → 'never', e NON è un allarme", async () => {
    mockRuns([], []);
    const h = await loadCronHealth(NOW);
    expect(h.rows).toHaveLength(CRON_EXPECTATIONS.length);
    expect(h.rows.every((r) => r.status === "never")).toBe(true);
    expect(h.problems).toHaveLength(0);
    expect(h.healthy).toBe(true);
  });

  it("giro riuscito dentro la finestra → ok", async () => {
    mockRuns(
      [{ name: "campaign-tick", startedAt: hoursAgo(3), ok: true, durationMs: 1200, errorDetail: null }],
      [{ name: "campaign-tick", startedAt: hoursAgo(3) }]
    );
    const h = await loadCronHealth(NOW);
    const row = h.rows.find((r) => r.name === "campaign-tick")!;
    expect(row.status).toBe("ok");
    expect(row.hoursSinceOk).toBe(3);
  });

  it("silenzio oltre la finestra → problema", async () => {
    // campaign-tick è giornaliero: 26h di tolleranza, 40h è fermo.
    mockRuns(
      [{ name: "campaign-tick", startedAt: hoursAgo(40), ok: true, durationMs: 900, errorDetail: null }],
      [{ name: "campaign-tick", startedAt: hoursAgo(40) }]
    );
    const h = await loadCronHealth(NOW);
    const row = h.rows.find((r) => r.name === "campaign-tick")!;
    expect(row.status).toBe("silent");
    expect(h.healthy).toBe(false);
    expect(h.problems).toContain(row);
  });

  it("ultimo giro fallito ma uno recente riuscito → failing", async () => {
    mockRuns(
      [{ name: "webhook-retry", startedAt: hoursAgo(0.2), ok: false, durationMs: 50, errorDetail: "Error: boom" }],
      [{ name: "webhook-retry", startedAt: hoursAgo(0.5) }]
    );
    const h = await loadCronHealth(NOW);
    const row = h.rows.find((r) => r.name === "webhook-retry")!;
    expect(row.status).toBe("failing");
    expect(cronProblemLine(row)).toContain("boom");
  });

  it("giro aperto da troppo tempo → appeso (firma del timeout)", async () => {
    mockRuns(
      [{ name: "scraping-audit", startedAt: hoursAgo(1), ok: null, durationMs: null, errorDetail: null }],
      [{ name: "scraping-audit", startedAt: hoursAgo(3) }],
      [{ name: "scraping-audit", startedAt: hoursAgo(1) }]
    );
    const h = await loadCronHealth(NOW);
    const row = h.rows.find((r) => r.name === "scraping-audit")!;
    expect(row.status).toBe("stuck");
    expect(cronProblemLine(row)).toContain("timeout");
  });

  it("un fallimento non nasconde il silenzio di un altro", async () => {
    mockRuns(
      [
        { name: "webhook-retry", startedAt: hoursAgo(0.2), ok: false, durationMs: 10, errorDetail: null },
        { name: "campaign-tick", startedAt: hoursAgo(50), ok: true, durationMs: 10, errorDetail: null },
      ],
      [
        { name: "webhook-retry", startedAt: hoursAgo(0.5) },
        { name: "campaign-tick", startedAt: hoursAgo(50) },
      ]
    );
    const h = await loadCronHealth(NOW);
    expect(h.problems.map((p) => p.name).sort()).toEqual(["campaign-tick", "webhook-retry"]);
  });
});
