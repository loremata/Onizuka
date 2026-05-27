import { buildProductionReadinessChecklist } from "@/lib/production-readiness";

describe("production-readiness", () => {
  it("includes dns as manual todo", () => {
    const items = buildProductionReadinessChecklist();
    const dns = items.find((i) => i.id === "dns");
    expect(dns?.status).toBe("todo");
  });

  it("includes elevenlabs and vault pin readiness items", () => {
    const items = buildProductionReadinessChecklist();
    expect(items.some((i) => i.id === "tts-elevenlabs")).toBe(true);
    expect(items.some((i) => i.id === "memory-vault-pin")).toBe(true);
    expect(items.some((i) => i.id === "memory-key-rotation")).toBe(true);
  });
});
