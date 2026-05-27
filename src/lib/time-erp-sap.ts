import type { TimeEntry } from "@prisma/client";

type Row = TimeEntry & { client: { companyName: string } | null; owner: { email: string } };

function esc(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/** Export CSV compatibile import SAP Business One / CATS (semicolon). */
export function formatTimeEntriesSapCsv(rows: Row[]): string {
  const header = [
    "PERNR",
    "WORKDATE",
    "CATSHOURS",
    "AUFNR",
    "LTXA1",
    "KUNNR",
    "BILLABLE",
    "RATE",
    "AMOUNT",
  ];
  const lines = [header.join(";")];
  for (const r of rows) {
    const hours = (r.minutes / 60).toFixed(2);
    const rate = r.hourlyRateEur != null ? Number(r.hourlyRateEur.toString()) : "";
    const amount =
      r.hourlyRateEur != null
        ? ((r.minutes / 60) * Number(r.hourlyRateEur.toString())).toFixed(2)
        : "";
    lines.push(
      [
        esc((r.owner.email.split("@")[0] ?? "USER").slice(0, 12)),
        new Intl.DateTimeFormat("en-CA").format(r.workedAt),
        hours,
        esc((r.projectCode ?? "GEN").replace(/\r?\n/g, " ")),
        esc(r.description.slice(0, 40).replace(/\r?\n/g, " ")),
        esc((r.client?.companyName ?? "").slice(0, 35)),
        r.billable ? "X" : "",
        rate,
        amount,
      ].join(";")
    );
  }
  return "\uFEFF" + lines.join("\n");
}

export function isSapErpPullConfigured(): boolean {
  const url = process.env.TIME_ERP_PULL_URL?.trim();
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

/** Stato connettore pull SAP/ERP (HEAD o GET leggero). */
export async function probeSapErpPullStatus(): Promise<{
  configured: boolean;
  ok: boolean;
  status?: number;
  message: string;
}> {
  const url = process.env.TIME_ERP_PULL_URL?.trim();
  if (!url) {
    return { configured: false, ok: false, message: "TIME_ERP_PULL_URL non impostato." };
  }

  const secret = process.env.TIME_ERP_PULL_SECRET?.trim();
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(url, { method: "HEAD", headers, signal: ac.signal });
    clearTimeout(t);
    return {
      configured: true,
      ok: res.ok,
      status: res.status,
      message: res.ok ? "Endpoint ERP raggiungibile." : `ERP risponde HTTP ${res.status}.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore di rete";
    return { configured: true, ok: false, message: msg };
  }
}
