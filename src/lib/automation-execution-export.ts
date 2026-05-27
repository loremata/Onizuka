type ExecutionRow = {
  id: string;
  createdAt: Date;
  channel: string;
  success: boolean;
  attemptCount: number;
  errorDetail: string | null;
  rule: { name: string };
};

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatAutomationExecutionsCsv(rows: ExecutionRow[]): string {
  const header = ["createdAt", "ruleName", "channel", "success", "attemptCount", "errorDetail", "id"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const err = (r.errorDetail ?? "").replace(/\r?\n/g, " ");
    lines.push(
      [
        csvEscape(r.createdAt.toISOString()),
        csvEscape(r.rule.name),
        csvEscape(r.channel),
        r.success ? "true" : "false",
        String(r.attemptCount),
        csvEscape(err),
        csvEscape(r.id),
      ].join(",")
    );
  }
  return "\uFEFF" + lines.join("\n");
}
