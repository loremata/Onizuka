import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureClientForLead } from "@/lib/ensure-client-for-lead";
import { clampStr, PUBLIC_FIELD_LIMITS as L } from "@/lib/clamp-input";

export const dynamic = "force-dynamic";

type Payload = {
  displayName?: string;
  phone?: string;
  vatNumber?: string;
  need?: string;
  nextStep?: string;
  refToken?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload;
    const displayName = clampStr(body.displayName, L.company);
    const phone = clampStr(body.phone, L.phone);
    if (!displayName || !phone) {
      return NextResponse.json({ error: "Nome e telefono richiesti." }, { status: 400 });
    }
    const need = clampStr(body.need, L.freeText);
    const nextStep = clampStr(body.nextStep, L.freeText);

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

    return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
  } catch (e) {
    console.error("[walkin.quick]", e);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
