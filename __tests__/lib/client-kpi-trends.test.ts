import { bucketCountsByDay } from "@/lib/client-kpi-trends";

describe("client-kpi-trends", () => {
  it("buckets dates into last N days", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const buckets = bucketCountsByDay([today], 3, "en-US");
    expect(buckets).toHaveLength(3);
    expect(buckets[buckets.length - 1].count).toBe(1);
  });
});
