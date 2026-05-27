import { runWithDb } from "@/lib/with-db";

describe("runWithDb", () => {
  it("returns data on success", async () => {
    const result = await runWithDb(async () => 42);
    expect(result).toEqual({ ok: true, data: 42 });
  });

  it("returns unavailable on connection message", async () => {
    const result = await runWithDb(async () => {
      throw new Error("Can't reach database server at `127.0.0.1:5433`");
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
