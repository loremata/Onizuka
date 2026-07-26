import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureClientForLead } from "@/lib/ensure-client-for-lead";
import { clampStr, PUBLIC_FIELD_LIMITS as L } from "@/lib/clamp-input";
import { checkRateLimitPublicWalkin, getRequestIp } from "@/lib/rate-limit";
import { notifyInboundLead } from "@/lib/lead-inbound-notify";

export const dynamic = "force-dynamic";

type Payload = {
  displayName?: string;
  phone?: string;
  vatNumber?: string;
  need?: string;
  nextStep?: string;
  refToken?: string;
  /** Honeypot anti-bot: deve restare vuoto. */
  company_website?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Rate-limit generoso per IP (mitiga abuso/flooding del form pubblico).
    const rl = await checkRateLimitPublicWalkin(getRequestIp(request));
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Troppe richieste. Riprova tra ${rl.retryAfter}s.` },
        { status: 429 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Payload;

    // Honeypot: un bot compila il campo nascosto → fingiamo successo, non creiamo nulla.
    if (String(body.company_website ?? "").trim()) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const displayName = clampStr(body.displayName, L.company);
    const phone = clampStr(body.phone, L.phone);
    if (!displayName || !phone) {
      return NextResponse.json({ error: "Nome e telefono richiesti." }, { status: 400 });
    }
    const need = clampStr(body.need, L.freeText);
    const nextStep = clampStr(body.nextStep, L.freeText);

    // Anti-doppione: stesso telefono da walk-in negli ultimi 15 minuti → ritorna il lead esistente.
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const dup = await prisma.lead.findFirst({
      where: {
        source: { in: ["walk_in", "segnalatore_walkin"] },
        createdAt: { gte: since },
        phone,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (dup) {
      return NextResponse.json({ ok: true, leadId: dup.id, deduped: true }, { status: 200 });
    }

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (!admin) {
      return NextResponse.json({ error: "Sistema non configurato." }, { status: 503 });
    }

    let referrerId: string | undefined;
    const refToken = String(body.refToken ?? "").trim();
    if (refToken) {
      const ref = await prisma.referrer.findFirst({
        where: { submissionToken: refToken, active: true },
        select: { id: true },
      });
      referrerId = ref?.id;
    }

    const lead = await prisma.lead.create({
      data: {
        ownerUserId: admin.id,
        title: displayName,
        businessName: displayName,
        phone,
        vatNumber: clampStr(body.vatNumber, L.vat) || undefined,
        source: referrerId ? "segnalatore_walkin" : "walk_in",
        referrerId,
        status: "NEW",
        commercialProspectStage: "PROSPECT_ENTERED",
        notes: JSON.stringify({
          need: need || null,
          nextStep: nextStep || null,
          walkin: true,
        }),
      },
    });

    // Unificazione: anche il walk-in ha un Client (identità unica, dedup per P.IVA).
    await ensureClientForLead(lead.id).catch(() => undefined);

    await prisma.leadFollowup.create({
      data: {
        leadId: lead.id,
        type: "walkin_enrichment",
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notes: `Enrichment walk-in. Bisogno: ${need || "n/d"} · Prossimo: ${nextStep || "n/d"}`,
        outcome: "pending",
      },
    });

    // Notifica in tempo reale all'admin (best-effort: non deve mai rompere la submission).
    void notifyInboundLead({
      source: "walkin",
      leadId: lead.id,
      businessName: displayName,
      contactName: null,
      phone,
      city: null,
      payloadSummary: `Esigenza: ${need || "n/d"}. Prossimo passo: ${nextStep || "n/d"}.`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
  } catch (e) {
    console.error("[walkin.quick]", e);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
