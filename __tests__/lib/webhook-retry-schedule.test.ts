import { computeNextWebhookRetryAt } from "@/lib/webhook-retry-schedule";

describe("webhook-retry-schedule", () => {
  it("schedules first auto retry after 2 attempts", () => {
    const from = new Date("2026-05-15T12:00:00.000Z");
    const next = computeNextWebhookRetryAt(2, from);
    expect(next?.toISOString()).toBe("2026-05-15T12:15:00.000Z");
  });

  it("stops after max backoff tier", () => {
    expect(computeNextWebhookRetryAt(6, new Date())).toBeNull();
  });
});
