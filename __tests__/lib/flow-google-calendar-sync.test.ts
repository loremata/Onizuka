import { syncFlowTaskToGoogleCalendar } from "@/lib/flow-google-calendar-sync";
import * as calendar from "@/lib/google-calendar-oauth";

jest.mock("@/lib/google-calendar-oauth", () => ({
  isGoogleCalendarConnected: jest.fn(),
  createGoogleCalendarFlowEvent: jest.fn(),
}));

describe("syncFlowTaskToGoogleCalendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("non chiama Google se non connesso", async () => {
    (calendar.isGoogleCalendarConnected as jest.Mock).mockResolvedValue(false);
    await syncFlowTaskToGoogleCalendar("u1", {
      taskId: "t1",
      title: "Call cliente",
      dueDate: new Date("2026-05-20T10:00:00Z"),
    });
    expect(calendar.createGoogleCalendarFlowEvent).not.toHaveBeenCalled();
  });

  it("crea evento se connesso", async () => {
    (calendar.isGoogleCalendarConnected as jest.Mock).mockResolvedValue(true);
    (calendar.createGoogleCalendarFlowEvent as jest.Mock).mockResolvedValue({ eventId: "ev1" });
    await syncFlowTaskToGoogleCalendar("u1", {
      taskId: "t1",
      title: "Call cliente",
      dueDate: new Date("2026-05-20T10:00:00Z"),
      clientName: "Acme",
    });
    expect(calendar.createGoogleCalendarFlowEvent).toHaveBeenCalledWith("u1", {
      taskId: "t1",
      title: "Call cliente",
      dueDate: expect.any(Date),
      clientName: "Acme",
    });
  });
});
