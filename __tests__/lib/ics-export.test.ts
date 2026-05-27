import { buildIcsCalendar, flowTaskToIcsEvent } from "@/lib/ics-export";

describe("ics-export", () => {
  it("builds valid calendar skeleton", () => {
    const ics = buildIcsCalendar([
      flowTaskToIcsEvent({
        id: "t1",
        title: "Call cliente",
        dueDate: new Date("2026-05-20T10:00:00Z"),
        clientName: "Demo",
      }),
    ]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("Call cliente");
  });
});
