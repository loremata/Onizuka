export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildCsvFromRows(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map((c) => csvEscape(String(c))).join(",")).join("\n");
}
