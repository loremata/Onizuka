import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { ownedSlugsFromRows } from "@/lib/campaigns/ownership";
import {
  reconcileClientEnrollments,
  applyDueSend,
  loadActiveCampaigns,
  type EligibilityCampaign,
  type ReconcileAction,
} from "@/lib/campaigns/engine";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Cron "campaign-tick" — Fase 0 (SIMULAZIONE, nessuna email reale).
 *
 * Per i clienti attivi (CLIENTE/ACTIVE_CLIENT):
 *  1. riconcilia le iscrizioni in DRY-RUN (nessuna auto-iscrizione: si limita a
 *     riportare cosa farebbe → nessun churn indesiderato in Fase 0);
 *  2. per le iscrizioni ACTIVE già esistenti materializza gli invii DOVUTI come
 *     `CampaignSend` con status SIMULATED (l'email NON parte).
 *
 * Poiché il seed crea le campagne in DRAFT, all'inizio non esistono iscrizioni
 * ACTIVE e il tick è di fatto a vuoto: diventa operativo quando Lorenzo attiva
 * le campagne. Batch-load per evitare N+1.
 */
function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (timingSafeStrEqual(header, `Bearer ${secret}`)) return true;
  return timingSafeStrEqual(request.headers.get("x-cron-secret"), secret);
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");
  }

  const now = new Date();
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 300), 1), 1000);

  const activeCampaigns: EligibilityCampaign[] = await loadActiveCampaigns();

  // --- Clienti attivi ---
  const clients = await prisma.client.findMany({
    where: { OR: [{ status: "ACTIVE_CLIENT" }, { relationshipState: "CLIENTE" }] },
    select: { id: true, marketingConsentBasis: true, marketingOptOutAt: true },
    take: limit,
  });
  const clientIds = clients.map((c) => c.id);

  // --- Batch-load possesso servizi + iscrizioni attive (niente N+1) ---
  type ServiceRow = { clientId: string; commercialService: { slug: string } };
  type ContractRow = { clientId: string; kind: string };
  type EnrollmentRow = {
    id: string;
    clientId: string;
    campaignId: string;
    campaign: { key: string; targetServiceSlug: string; priority: number };
  };
  const [services, contracts, activeEnrollments] = clientIds.length
    ? await Promise.all([
        prisma.clientCommercialService.findMany({
          where: { clientId: { in: clientIds }, active: true },
          select: { clientId: true, commercialService: { select: { slug: true } } },
        }),
        prisma.clientRetailContract.findMany({
          where: { clientId: { in: clientIds }, status: "ACTIVE" },
          select: { clientId: true, kind: true },
        }),
        prisma.campaignEnrollment.findMany({
          where: { clientId: { in: clientIds }, status: "ACTIVE" },
          select: {
            id: true,
            clientId: true,
            campaignId: true,
            campaign: { select: { key: true, targetServiceSlug: true, priority: true } },
          },
        }),
      ])
    : ([[], [], []] as [ServiceRow[], ContractRow[], EnrollmentRow[]]);

  // Indicizza per cliente.
  const slugsByClient = new Map<string, string[]>();
  for (const s of services) {
    const arr = slugsByClient.get(s.clientId) ?? [];
    arr.push(s.commercialService.slug);
    slugsByClient.set(s.clientId, arr);
  }
  const kindsByClient = new Map<string, string[]>();
  for (const c of contracts) {
    const arr = kindsByClient.get(c.clientId) ?? [];
    arr.push(c.kind);
    kindsByClient.set(c.clientId, arr);
  }
  const enrollByClient = new Map<string, typeof activeEnrollments>();
  for (const e of activeEnrollments) {
    const arr = enrollByClient.get(e.clientId) ?? [];
    arr.push(e);
    enrollByClient.set(e.clientId, arr);
  }

  // --- 1) Riconciliazione DRY-RUN per ogni cliente ---
  const actionTotals: Record<ReconcileAction["type"], number> = {
    CONVERT: 0, SUPPRESS: 0, ENROLL: 0, HIGHER_PRIORITY_AVAILABLE: 0, NOOP: 0,
  };
  for (const client of clients) {
    const ownedSlugs = ownedSlugsFromRows(
      slugsByClient.get(client.id) ?? [],
      kindsByClient.get(client.id) ?? [],
    );
    const res = await reconcileClientEnrollments({
      clientId: client.id,
      dryRun: true,
      now,
      ctx: {
        client: { marketingConsentBasis: client.marketingConsentBasis, marketingOptOutAt: client.marketingOptOutAt },
        ownedSlugs,
        activeEnrollments: enrollByClient.get(client.id) ?? [],
        activeCampaigns,
      },
    });
    for (const a of res.actions) actionTotals[a.type] += 1;
  }

  // --- 2) Materializza gli invii dovuti come CampaignSend SIMULATED ---
  //     (nessuna email reale in Fase 0). Servono gli step delle campagne coinvolte.
  let simulatedSends = 0;
  let completedEnrollments = 0;
  if (activeEnrollments.length) {
    const campaignIds = Array.from(new Set(activeEnrollments.map((e) => e.campaignId)));
    const stepRows = await prisma.crossSellCampaignStep.findMany({
      where: { campaignId: { in: campaignIds } },
      select: { id: true, campaignId: true, stepIndex: true, delayDays: true },
    });
    const stepsByCampaign = new Map<string, typeof stepRows>();
    for (const s of stepRows) {
      const arr = stepsByCampaign.get(s.campaignId) ?? [];
      arr.push(s);
      stepsByCampaign.set(s.campaignId, arr);
    }

    // Serve enrolledAt/currentStepIndex: rileggiamo i campi mancanti in un colpo.
    const enrollDetails = await prisma.campaignEnrollment.findMany({
      where: { id: { in: activeEnrollments.map((e) => e.id) }, status: "ACTIVE" },
      select: { id: true, enrolledAt: true, currentStepIndex: true, status: true, campaignId: true },
    });

    for (const en of enrollDetails) {
      const steps = stepsByCampaign.get(en.campaignId) ?? [];
      if (steps.length === 0) continue;
      const out = await applyDueSend({
        enrollment: { id: en.id, enrolledAt: en.enrolledAt, currentStepIndex: en.currentStepIndex, status: en.status },
        steps: steps.map((s) => ({ id: s.id, stepIndex: s.stepIndex, delayDays: s.delayDays })),
        now,
        dryRun: false, // scrive SOLO CampaignSend SIMULATED / avanzamento — nessuna email.
      });
      if (out.action === "SIMULATED_SEND") simulatedSends += 1;
      if (out.action === "COMPLETED") completedEnrollments += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    phase: "SIMULATION",
    clientsScanned: clients.length,
    activeCampaigns: activeCampaigns.length,
    activeEnrollments: activeEnrollments.length,
    reconcile: actionTotals,
    simulatedSends,
    completedEnrollments,
  });
}
