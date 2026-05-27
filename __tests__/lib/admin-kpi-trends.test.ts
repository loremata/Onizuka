import { localDateKey, bucketCountsByDay } from "@/lib/client-kpi-trends";

describe("admin-kpi-trends helpers", () => {
  it("localDateKey matches bucket day for local noon", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const buckets = bucketCountsByDay([today], 3);
    expect(buckets[buckets.length - 1].count).toBe(1);
    expect(buckets[buckets.length - 1].day).toBe(localDateKey(today));
  });
});
