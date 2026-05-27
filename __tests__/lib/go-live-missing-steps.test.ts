import { buildGoLiveMissingSteps } from "@/lib/go-live-missing-steps";

describe("buildGoLiveMissingSteps", () => {
  it("flags required todos when env and DB incomplete", () => {
    const report = buildGoLiveMissingSteps({
      readiness: [
        { id: "auth", label: "Auth", status: "todo" },
        { id: "cron", label: "Cron", status: "todo" },
        { id: "smtp", label: "SMTP", status: "optional" },
      ],
      opsClosure: [],
      databaseOk: false,
      batchFMigrated: false,
      weakSeedEmails: ["admin@demo.local"],
      mustChangePasswordCount: 1,
    });

    expect(report.productCodeComplete).toBe(true);
    expect(report.requiredOpen).toBeGreaterThan(0);
    expect(report.steps.some((s) => s.id === "migrate-batch-f")).toBe(true);
    expect(report.steps.some((s) => s.id === "seed-passwords")).toBe(true);
  });

  it("has zero required open when all critical checks pass", () => {
    const report = buildGoLiveMissingSteps({
      readiness: [
        { id: "auth", label: "Auth", status: "done" },
        { id: "db", label: "DB", status: "done" },
        { id: "direct-url", label: "Direct", status: "done" },
        { id: "cron", label: "Cron", status: "done" },
        { id: "storage", label: "Storage", status: "done" },
      ],
      opsClosure: [],
      databaseOk: true,
      batchFMigrated: true,
      weakSeedEmails: [],
      mustChangePasswordCount: 0,
    });

    const requiredTodos = report.steps.filter(
      (s) => s.category === "required" && s.status === "todo"
    );
    expect(requiredTodos).toHaveLength(0);
    expect(report.requiredOpen).toBe(0);
  });
});
