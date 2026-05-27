import { buildOpsClosureChecklist } from "@/lib/ops-readiness";

describe("buildOpsClosureChecklist", () => {
  it("includes core closure items", () => {
    const items = buildOpsClosureChecklist();
    const ids = items.map((i) => i.id);
    expect(ids).toContain("audit-sheet");
    expect(ids).toContain("dedupe-gpu-worker");
    expect(ids).toContain("k8s-automation");
    expect(ids).toContain("meta-publish");
    expect(ids).toContain("dns");
  });
});
