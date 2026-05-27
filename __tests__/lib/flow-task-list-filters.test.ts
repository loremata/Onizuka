import {
  buildOwnedFlowTaskWhere,
  parseFlowTaskListFilters,
} from "@/lib/flow-task-list-filters";

describe("flow-task-list-filters", () => {
  it("parses clientId and due=today", () => {
    const f = parseFlowTaskListFilters({ clientId: "c1", due: "today", q: "call" });
    expect(f.clientId).toBe("c1");
    expect(f.due).toBe("today");
    expect(f.q).toBe("call");
  });

  it("builds due today clause with bounds", () => {
    const dayStart = new Date("2026-05-15T00:00:00.000Z");
    const dayEnd = new Date("2026-05-15T23:59:59.999Z");
    const where = buildOwnedFlowTaskWhere(
      "user-1",
      { q: "", status: null, clientId: "", due: "today" },
      { dayStart, dayEnd }
    );
    expect(where).toMatchObject({
      ownerUserId: "user-1",
      status: { in: ["TODO", "IN_PROGRESS", "WAITING"] },
      dueDate: { gte: dayStart, lte: dayEnd },
    });
  });
});
