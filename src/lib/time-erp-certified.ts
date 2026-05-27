import type { TimeEntry } from "@prisma/client";
import { getErpOAuthAccessToken } from "@/lib/erp-oauth";

type Row = TimeEntry & { client: { companyName: string } | null; owner: { email: string } };

export function isZucchettiApiConfigured(): boolean {
  const url = process.env.ZUCCHETTI_API_URL?.trim();
  const key = process.env.ZUCCHETTI_API_KEY?.trim();
  return !!(url && key);
}

export function isSapApiConfigured(): boolean {
  const url = process.env.SAP_API_URL?.trim();
  const key = process.env.SAP_API_KEY?.trim();
  return !!(url && key);
}

/** Push ore verso API REST Zucchetti (formato JSON documentato dal partner). */
export async function pushTimeEntriesToZucchettiApi(
  rows: Row[],
  ownerUserId?: string
): Promise<{
  ok: boolean;
  pushed: number;
  message: string;
}> {
  const base = process.env.ZUCCHETTI_API_URL?.trim();
  let key = process.env.ZUCCHETTI_API_KEY?.trim();
  if (ownerUserId) {
    const oauth = await getErpOAuthAccessToken(ownerUserId, "ZUCCHETTI_ERP");
    if (oauth) key = oauth;
  }
  if (!base || !key) {
    return { ok: false, pushed: 0, message: "ZUCCHETTI_API_URL / ZUCCHETTI_API_KEY (o OAuth) non configurati." };
  }

  const payload = {
    source: "onizuka",
    entries: rows.map((r) => ({
      date: r.workedAt.toISOString().slice(0, 10),
      projectCode: r.projectCode ?? "GEN",
      hours: Number((r.minutes / 60).toFixed(2)),
      description: r.description.slice(0, 200),
      clientName: r.client?.companyName ?? "",
      employeeCode: r.owner.email.split("@")[0],
      billable: r.billable,
    })),
  };

  const res = await fetch(`${base.replace(/\/$/, "")}/timesheets/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Onizuka-Source": "time-export",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, pushed: 0, message: `Zucchetti API ${res.status}: ${err.slice(0, 200)}` };
  }

  return { ok: true, pushed: rows.length, message: "Import Zucchetti accettato." };
}

/** Push ore verso SAP Business One Service Layer (odata-style stub). */
export async function pushTimeEntriesToSapApi(rows: Row[], ownerUserId?: string): Promise<{
  ok: boolean;
  pushed: number;
  message: string;
}> {
  const base = process.env.SAP_API_URL?.trim();
  let key = process.env.SAP_API_KEY?.trim();
  if (ownerUserId) {
    const oauth = await getErpOAuthAccessToken(ownerUserId, "SAP_ERP");
    if (oauth) key = oauth;
  }
  if (!base || !key) {
    return { ok: false, pushed: 0, message: "SAP_API_URL / SAP_API_KEY (o OAuth) non configurati." };
  }

  const payload = {
    CATSRecords: rows.map((r) => ({
      WORKDATE: r.workedAt.toISOString().slice(0, 10),
      AUFNR: r.projectCode ?? "GEN",
      CATSHOURS: Number((r.minutes / 60).toFixed(2)),
      LTXA1: r.description.slice(0, 40),
      PERNR: r.owner.email.split("@")[0]?.slice(0, 12),
    })),
  };

  const res = await fetch(`${base.replace(/\/$/, "")}/b1s/v1/CATS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, pushed: 0, message: `SAP API ${res.status}: ${err.slice(0, 200)}` };
  }

  return { ok: true, pushed: rows.length, message: "Import SAP accettato." };
}

/** Pull stato timesheet da ERP (GET leggero). */
export async function pullErpTimesheetStatus(vendor: "zucchetti" | "sap"): Promise<{
  ok: boolean;
  message: string;
}> {
  if (vendor === "zucchetti") {
    const base = process.env.ZUCCHETTI_API_URL?.trim();
    const key = process.env.ZUCCHETTI_API_KEY?.trim();
    if (!base || !key) return { ok: false, message: "Zucchetti API non configurata." };
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/health`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      return { ok: res.ok, message: res.ok ? "Zucchetti API online." : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Errore rete" };
    }
  }

  const base = process.env.SAP_API_URL?.trim();
  const key = process.env.SAP_API_KEY?.trim();
  if (!base || !key) return { ok: false, message: "SAP API non configurata." };
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/$metadata`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return { ok: res.ok, message: res.ok ? "SAP Service Layer raggiungibile." : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Errore rete" };
  }
}
