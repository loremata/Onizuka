import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Calendar ICS", () => {
  test("ics endpoint returns calendar file", async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get("/api/admin/calendar/ics");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
  });
});
