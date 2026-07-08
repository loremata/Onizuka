import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureClientForLead } from "@/lib/ensure-client-for-lead";

export const dynamic = "force-dynamic";

/**
 * Ingestione pubblica del "Configuratore Risparmio" pubblicato su onlinestation.it.
 * Gemello di /api/public/walkin/quick: crea un Lead (pipeline dedicata source="configuratore"),
 * garantisce il Client satellite (identità unica, dedup P.IVA/CF) e programma un followup di richiamo.
 *
 * Distinzione privato/azienda: la scelta esplicita del configuratore (kind) vince sull'inferenza
 * da P.IVA/CF — così un privato che non lascia il CF non viene classificato come azienda.
 */

const ALLOWED_ORIGINS = [
  "https://onlinestation.it",
  "https://www.onlinestation.it",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

type ServiceKey = "luce_gas" | "telefonia" | "streaming";

type Estimate = {
  minYear?: number;
  maxYear?: number;
  perService?: Record<string, { min: number; max: number }>;
};

type Payload = {
  kind?: "PRIVATE" | "BUSINESS";
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
  fiscalCode?: string;
  city?: string;
  services?: ServiceKey[];
  answers?: Record<string, unknown>;
  estimate?: Estimate;
  consent?: boolean;
  consentText?: string;
  /** Honeypot anti-bot: deve restare vuoto. */
  company_website?: string;
};

const SERVICE_LABEL: Record<ServiceKey, string> = {
  luce_gas: "Luce & Gas",
  telefonia: "Telefonia / Fibra",
  streaming: "Streaming TV",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonRes(body: unknown, init: { status: number; origin: string | null }) {
  return NextResponse.json(body, {
    status: init.status,
    headers: corsHeaders(init.origin),
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const body = (await request.json().catch(() => ({}))) as Payload;

    // Honeypot: un bot compila il campo nascosto → fingiamo successo, non creiamo nulla.
    if (String(body.company_website ?? "").trim()) {
      return jsonRes({ ok: true }, { status: 200, origin });
    }

    const kind: "PRIVATE" | "BUSINESS" = body.kind === "BUSINESS" ? "BUSINESS" : "PRIVATE";
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const companyName = String(body.companyName ?? "").trim();
    const consent = body.consent === true;
    const services = Array.isArray(body.services)
      ? body.services.filter((s): s is ServiceKey => s in SERVICE_LABEL)
      : [];

    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!fullName) {
      return jsonRes({ error: "Nome richiesto." }, { status: 400, origin });
    }
    if (!phone) {
      return jsonRes({ error: "Telefono richiesto." }, { status: 400, origin });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return jsonRes({ error: "Email non valida." }, { status: 400, origin });
    }
    if (!consent) {
      return jsonRes({ error: "Consenso privacy richiesto." }, { status: 400, origin });
    }

    const vatNumber = kind === "BUSINESS" ? String(body.vatNumber ?? "").trim() || undefined : undefined;
    const fiscalCode = kind === "PRIVATE" ? String(body.fiscalCode ?? "").trim() || undefined : undefined;
    const city = String(body.city ?? "").trim() || undefined;

    // Anti-doppione: stesso contatto dal configuratore negli ultimi 15 minuti → ritorna il lead esistente.
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const dup = await prisma.lead.findFirst({
      where: {
        source: "configuratore",
        createdAt: { gte: since },
        OR: [{ email }, { phone }],
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (dup) {
      return jsonRes({ ok: true, leadId: dup.id, deduped: true }, { status: 200, origin });
    }

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (!admin) {
      return jsonRes({ error: "Sistema non configurato." }, { status: 503, origin });
    }

    const estimate = body.estimate ?? {};
    const servicesLabel = services.map((s) => SERVICE_LABEL[s]).join(", ") || "n/d";
    const rangeLabel =
      typeof estimate.minYear === "number" && typeof estimate.maxYear === "number"
        ? `${Math.round(estimate.minYear)}–${Math.round(estimate.maxYear)} €/anno`
        : "n/d";

    const notes = JSON.stringify({
      source: "configuratore",
      kind,
      services,
      servicesLabel,
      answers: body.answers ?? null,
      estimate,
      city: city ?? null,
      consent: {
        given: true,
        text: String(body.consentText ?? "").slice(0, 500) || null,
        at: new Date().toISOString(),
      },
    });

    const lead = await prisma.lead.create({
      data: {
        ownerUserId: admin.id,
        title: `Configuratore · ${kind === "BUSINESS" ? companyName || fullName : fullName}`,
        contactName: fullName,
        businessName: kind === "BUSINESS" ? companyName || fullName : undefined,
        email,
        phone,
        vatNumber,
        fiscalCode,
        city,
        source: "configuratore",
        status: "NEW",
        clientMacroCategory: "RETAIL_STORE",
        commercialProspectStage: "PROSPECT_ENTERED",
        notes,
      },
    });

    // Identità unica: crea/riusa il Client, poi forza la scelta esplicita privato/azienda.
    const clientId = await ensureClientForLead(lead.id).catch(() => null);
    if (clientId) {
      await prisma.client
        .update({
          where: { id: clientId },
          data: {
            kind,
            clientMacroCategory: "RETAIL_STORE",
            tags: { push: ["configuratore", ...services] },
          },
        })
        .catch(() => undefined);
    }

    await prisma.leadFollowup.create({
      data: {
        leadId: lead.id,
        type: "configuratore_callback",
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notes: `Richiamo configuratore. Servizi: ${servicesLabel}. Stima: ${rangeLabel}.`,
        outcome: "pending",
      },
    });

    return jsonRes({ ok: true, leadId: lead.id }, { status: 201, origin });
  } catch (e) {
    console.error("[public.configuratore]", e);
    return jsonRes({ error: "Errore interno" }, { status: 500, origin });
  }
}
