import { runFlowDueReminders, purgeOldNotifications } from "@/lib/flow-due-notifications";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    flowTask: { findMany: jest.fn() },
    userNotification: { findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("@/lib/prisma") as {
  prisma: {
    flowTask: { findMany: jest.Mock };
    userNotification: { findFirst: jest.Mock; create: jest.Mock; deleteMany: jest.Mock };
  };
};

const DAY_START = new Date("2026-07-28T00:00:00.000Z");
const DAY_END = new Date("2026-07-28T23:59:59.999Z");
const daysAgo = (d: number) => new Date(DAY_START.getTime() - d * 86_400_000);

const task = (id: string, dueDate: Date, ownerUserId = "u1") => ({
  id,
  title: `Task ${id}`,
  dueDate,
  ownerUserId,
  client: null,
});

describe("promemoria task", () => {
  beforeEach(() => {
    prisma.flowTask.findMany.mockReset();
    prisma.userNotification.findFirst.mockReset();
    prisma.userNotification.create.mockReset().mockResolvedValue({});
    prisma.userNotification.deleteMany.mockReset();
  });

  it("pochi task: una notifica ciascuna, con il titolo", async () => {
    prisma.flowTask.findMany.mockResolvedValue([task("a", daysAgo(3)), task("b", DAY_END)]);
    prisma.userNotification.findFirst.mockResolvedValue(null);

    const res = await runFlowDueReminders(DAY_START, DAY_END);
    expect(res).toMatchObject({ overdue: 1, dueToday: 1, skipped: 0 });
    expect(prisma.userNotification.create).toHaveBeenCalledTimes(2);
    const kinds = prisma.userNotification.create.mock.calls.map((c) => c[0].data.kind);
    expect(kinds.sort()).toEqual(["flow_due_today", "flow_overdue_reminder"]);
  });

  it("tanti task: UN riepilogo, non una valanga", async () => {
    // 40 task in ritardo: prima erano 40 notifiche ogni singolo giorno.
    prisma.flowTask.findMany.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => task(`t${i}`, daysAgo(5)))
    );
    prisma.userNotification.findFirst.mockResolvedValue(null);

    const res = await runFlowDueReminders(DAY_START, DAY_END);
    expect(prisma.userNotification.create).toHaveBeenCalledTimes(1);
    const created = prisma.userNotification.create.mock.calls[0][0].data;
    expect(created.kind).toBe("flow_digest");
    expect(created.title).toContain("40 in ritardo");
    expect(res.digest).toEqual({ overdue: 40, dueToday: 0 });
  });

  it("un riepilogo per proprietario, non uno globale", async () => {
    prisma.flowTask.findMany.mockResolvedValue([
      ...Array.from({ length: 16 }, (_, i) => task(`a${i}`, daysAgo(2), "u1")),
      ...Array.from({ length: 5 }, (_, i) => task(`b${i}`, daysAgo(2), "u2")),
    ]);
    prisma.userNotification.findFirst.mockResolvedValue(null);

    await runFlowDueReminders(DAY_START, DAY_END);
    const users = prisma.userNotification.create.mock.calls.map((c) => c[0].data.userId);
    expect(users.sort()).toEqual(["u1", "u2"]);
  });

  it("il ritardo non si ripete ogni giorno: finestra di 30 giorni", async () => {
    prisma.flowTask.findMany.mockResolvedValue([task("a", daysAgo(3))]);
    prisma.userNotification.findFirst.mockResolvedValue({ id: "n1" }); // già avvisato

    const res = await runFlowDueReminders(DAY_START, DAY_END);
    expect(res.skipped).toBe(1);
    expect(prisma.userNotification.create).not.toHaveBeenCalled();

    const where = prisma.userNotification.findFirst.mock.calls[0][0].where;
    expect(where.createdAt.gte).toEqual(daysAgo(30));
  });

  it("la scadenza di oggi resta un fatto del giorno", async () => {
    prisma.flowTask.findMany.mockResolvedValue([task("a", DAY_END)]);
    prisma.userNotification.findFirst.mockResolvedValue(null);
    await runFlowDueReminders(DAY_START, DAY_END);
    const where = prisma.userNotification.findFirst.mock.calls[0][0].where;
    expect(where.createdAt.gte).toEqual(DAY_START);
  });

  it("i task senza scadenza o futuri non generano nulla", async () => {
    prisma.flowTask.findMany.mockResolvedValue([
      { ...task("a", DAY_END), dueDate: null },
      task("b", new Date(DAY_END.getTime() + 86_400_000)),
    ]);
    prisma.userNotification.findFirst.mockResolvedValue(null);
    const res = await runFlowDueReminders(DAY_START, DAY_END);
    expect(res).toEqual({ dueToday: 0, overdue: 0, skipped: 0 });
    expect(prisma.userNotification.create).not.toHaveBeenCalled();
  });
});

describe("retention notifiche", () => {
  beforeEach(() => prisma.userNotification.deleteMany.mockReset());

  it("promemoria effimeri a 7 giorni, il resto a 90", async () => {
    prisma.userNotification.deleteMany.mockResolvedValue({ count: 10 });
    const now = new Date("2026-07-28T12:00:00.000Z");
    const total = await purgeOldNotifications(now);
    expect(total).toBe(20);

    const [ephemeral, rest] = prisma.userNotification.deleteMany.mock.calls.map((c) => c[0].where);
    expect(ephemeral.kind.in).toContain("flow_overdue_reminder");
    expect(ephemeral.createdAt.lt).toEqual(new Date(now.getTime() - 7 * 86_400_000));
    expect(rest.kind.notIn).toContain("flow_overdue_reminder");
    expect(rest.createdAt.lt).toEqual(new Date(now.getTime() - 90 * 86_400_000));
  });
});
