import { flowTasksToAgenda, groupAgendaByDay } from "@/lib/calendar-agenda";

describe("calendar-agenda", () => {
  it("maps tasks with due dates and sorts ascending", () => {
    const items = flowTasksToAgenda([
      {
        id: "b",
        title: "Later",
        dueDate: new Date("2026-05-20T10:00:00Z"),
        status: "TODO",
        priority: "MEDIUM",
        relatedClientId: null,
        client: null,
      },
      {
        id: "a",
        title: "Soon",
        dueDate: new Date("2026-05-18T09:00:00Z"),
        status: "IN_PROGRESS",
        priority: "HIGH",
        relatedClientId: "c1",
        client: { companyName: "Demo" },
      },
      {
        id: "x",
        title: "No date",
        dueDate: null,
        status: "TODO",
        priority: "LOW",
        relatedClientId: null,
        client: null,
      },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("a");
    expect(items[0].clientName).toBe("Demo");
  });

  it("groups by calendar day", () => {
    const items = flowTasksToAgenda([
      {
        id: "1",
        title: "A",
        dueDate: new Date("2026-05-18T09:00:00Z"),
        status: "TODO",
        priority: "LOW",
        relatedClientId: null,
        client: null,
      },
    ]);
    const groups = groupAgendaByDay(items, "UTC");
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });
});
