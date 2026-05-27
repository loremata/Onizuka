/** @jest-environment node */

import { GET } from "@/app/api/notifications/unread-count/route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/user-notifications", () => ({
  countUnreadNotifications: jest.fn(() => Promise.resolve(3)),
}));

jest.mock("@/lib/notification-rev", () => ({
  getNotificationRev: jest.fn(() => Promise.resolve(7)),
}));

const { getServerSession } = require("next-auth");

describe("GET /api/notifications/unread-count", () => {
  it("returns 401 without session", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns count for authenticated user", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 3, rev: 7 });
  });
});
