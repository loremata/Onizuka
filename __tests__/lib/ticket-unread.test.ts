import { countUnreadTickets, isAdminReplyUnread, isTicketUnread } from "@/lib/ticket-unread";

describe("ticket-unread", () => {
  it("detects unread admin reply without read receipt", () => {
    expect(
      isAdminReplyUnread({
        createdByUserId: "admin-1",
        clientReadAt: null,
      })
    ).toBe(true);
    expect(
      isAdminReplyUnread({
        createdByUserId: "admin-1",
        clientReadAt: new Date(),
      })
    ).toBe(false);
  });

  it("ticket is unread when any admin reply is unread", () => {
    expect(
      isTicketUnread({
        updates: [
          { createdByUserId: "admin-1", clientReadAt: new Date() },
          { createdByUserId: "admin-1", clientReadAt: null },
        ],
      })
    ).toBe(true);
  });

  it("counts tickets with unread replies", () => {
    const n = countUnreadTickets([
      { updates: [] },
      {
        updates: [{ createdByUserId: "admin-1", clientReadAt: null }],
      },
    ]);
    expect(n).toBe(1);
  });
});
