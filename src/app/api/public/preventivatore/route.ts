import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureClientForLead } from "@/lib/ensure-client-for-lead";
import { clampStr, PUBLIC_FIELD_LIMITS as L } from "@/lib/clamp-input";

export const dynamic = "force-dynamic";

/**
 * Ingestione pubblica del "Preventivatore Servizi Digitali" pubblicato su onlinestation.it.
 * Gemello di /api/public/configuratore, ma per i SERVIZI DIGITALI (non retail/negozio):
 * l'utente sceglie i propri obiettivi e riceve un pacchetto consigliato con prezzo; qui creiamo
 * un Lead nella pipeline dedicata (source="preventivatore-digitale", macro DIGITAL_AI),
 * garantiamo il Client satellite (identità unica, dedup P.IVA/CF) e programmiamo un followup.
 *
 * Distinzione privato/azienda: la scelta esplicita (kind) vince sull'inferenza da P.IVA/CF.
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

type GoalKey = "sito" | "vendere" | "clienti" | "social" | "brand" | "ai";

type Recommendation = {
  code?: string;
  name?: string;
  brand?: string;
  price?: string;
  priceNote?: string;
  addons?: string[];
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
  goals?: GoalKey[];
  context?: Record<string, unknown>;
  recommendation?: Recommendation;
  consent?: boolean;
  consentText?: string;
  /** Honeypot anti-bot: deve restare vuoto. */
  company_website?: string;
};

const GOAL_LABEL: Record<GoalKey, string> = {
  sito: "Farmi trovare online",
  vendere: "Vendere online",
  clienti: "Avere più clienti",
  social: "Crescere sui social",
  brand: "Rifare l'immagine / brand",
  ai: "Automatizzare con l'AI",
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
    const firstName = clampStr(body.firstName, L.name);
    const lastName = clampStr(body.lastName, L.name);
    const email = clampStr(body.email, L.email).toLowerCase();
    const phone = clampStr(body.phone, L.phone);
    const companyName = clampStr(body.companyName, L.company);
    const consent = body.consent === true;
    const goals = Array.isArray(body.goals)
      ? body.goals.filter((g): g is GoalKey => g in GOAL_LABEL)
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

    const vatNumber = kind === "BUSINESS" ? clampStr(body.vatNumber, L.vat) || undefined : undefined;
    const fiscalCode = kind === "PRIVATE" ? clampStr(body.fiscalCode, L.fiscalCode) || undefined : undefined;
    const city = clampStr(body.city, L.city) || undefined;

    // Anti-doppione: stesso contatto dal preventivatore negli ultimi 15 minuti → ritorna il lead esistente.
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const dup = await prisma.lead.findFirst({
      where: {
        source: "preventivatore-digitale",
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

    const reco = body.recommendation ?? {};
    const goalsLabel = goals.map((g) => GOAL_LABEL[g]).join(", ") || "n/d";
    const recoLabel =
      reco.name
        ? `${reco.name}${reco.brand ? ` (${reco.brand})` : ""}${reco.price ? ` · ${reco.price}` : ""}`
        : "n/d";

    const notes = JSON.stringify({
      source: "preventivatore-digitale",
      kind,
      goals,
      goalsLabel,
      context: body.context ?? null,
      recommendation: reco,
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
        title: `Preventivatore · ${kind === "BUSINESS" ? companyName || fullName : fullName}`,
        contactName: fullName,
        businessName: kind === "BUSINESS" ? companyName || fullName : undefined,
        email,
        phone,
        vatNumber,
        fiscalCode,
        city,
        source: "preventivatore-digitale",
        status: "NEW",
        clientMacroCategory: "DIGITAL_AI",
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
            clientMacroCategory: "DIGITAL_AI",
            tags: { push: ["preventivatore", ...goals] },
          },
        })
        .catch(() => undefined);
    }

    await prisma.leadFollowup.create({
      data: {
        leadId: lead.id,
        type: "preventivatore_callback",
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notes: `Richiamo preventivatore. Obiettivi: ${goalsLabel}. Consigliato: ${recoLabel}.`,
        outcome: "pending",
      },
    });

    return jsonRes({ ok: true, leadId: lead.id }, { status: 201, origin });
  } catch (e) {
    console.error("[public.preventivatore]", e);
    return jsonRes({ error: "Errore interno" }, { status: 500, origin });
  }
}
