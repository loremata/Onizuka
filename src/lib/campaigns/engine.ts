/**
 * Cuore logico del motore "Campagne cross-sell".
 *
 * Fase 0 = SIMULAZIONE: nessun invio email reale. Gli invii vengono materializzati
 * come `CampaignSend` con status `SIMULATED`. Le transizioni di iscrizione
 * (arruolamento, conversione, soppressione, completamento) sono reali quando
 * `dryRun=false`, ma NON partono email.
 *
 * Funzioni pure (idoneità/schedulazione) separate dagli esecutori DB, così sono
 * testabili e riutilizzabili in batch dal cron (niente N+1).
 */

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isCampaignEmailable, type EmailableClient } from "@/lib/campaigns/consent";
import type {
  CampaignStatus,
  CampaignEnrollmentStatus,
  CampaignSendStatus,
  ClientRelationshipState,
} from "@prisma/client";

/** True se l'errore è una violazione di vincolo unico Prisma (P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ---------------------------------------------------------------------------
// Tipi leggeri (sottoinsiemi dei modelli Prisma) usati dalle funzioni pure.
// ---------------------------------------------------------------------------

/** Campi di campagna necessari per valutare l'idoneità di un cliente. */
export type EligibilityCampaign = {
  id: string;
  key: string;
  status: CampaignStatus;
  priority: number;
  targetServiceSlug: string;
  requiresAnyOwnedSlug: string[];
  excludesOwnedSlug: string[];
};

/** Uno step schedulabile. `delayDays` = giorni dall'iscrizione (vedi schema). */
export type SchedulableStep = {
  id: string;
  stepIndex: number;
  delayDays: number;
};

/** Iscrizione minima per la schedulazione degli step. */
export type SchedulableEnrollment = {
  id: string;
  enrolledAt: Date;
  currentStepIndex: number;
  status: CampaignEnrollmentStatus;
};

// ---------------------------------------------------------------------------
// Idoneità (PURE)
// ---------------------------------------------------------------------------

/**
 * Campagne ACTIVE per cui il cliente è idoneo, ordinate per priorità crescente
 * (priority più bassa = più importante). Idoneo se:
 *  - NON possiede il `targetServiceSlug`,
 *  - NON possiede alcuno slug in `excludesOwnedSlug`,
 *  - `requiresAnyOwnedSlug` è vuoto OPPURE ne possiede almeno uno.
 */
export function eligibleCampaignsForClient(
  ownedSlugs: Set<string>,
  campaigns: EligibilityCampaign[],
): EligibilityCampaign[] {
  const eligible = campaigns.filter((c) => {
    if (c.status !== "ACTIVE") return false;
    if (ownedSlugs.has(c.targetServiceSlug)) return false;
    if (c.excludesOwnedSlug.some((s) => ownedSlugs.has(s))) return false;
    if (c.requiresAnyOwnedSlug.length > 0 && !c.requiresAnyOwnedSlug.some((s) => ownedSlugs.has(s))) {
      return false;
    }
    return true;
  });
  return eligible.sort((a, b) => a.priority - b.priority);
}

/** La campagna idonea più prioritaria, o null se nessuna. */
export function pickCampaignForClient(
  ownedSlugs: Set<string>,
  campaigns: EligibilityCampaign[],
): EligibilityCampaign | null {
  return eligibleCampaignsForClient(ownedSlugs, campaigns)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Riconciliazione / propagazione
// ---------------------------------------------------------------------------

/** Azione decisa dalla riconciliazione (descrittiva, per la simulazione). */
export type ReconcileAction =
  | { type: "CONVERT"; enrollmentId: string; campaignKey: string; reason: string }
  | { type: "SUPPRESS"; enrollmentId: string; campaignKey: string; reason: string }
  | { type: "ENROLL"; campaignId: string; campaignKey: string; reason: string }
  | { type: "HIGHER_PRIORITY_AVAILABLE"; currentCampaignKey: string; betterCampaignKey: string }
  | { type: "NOOP"; reason: string };

export type ReconcileResult = {
  clientId: string;
  dryRun: boolean;
  emailable: boolean;
  ownedSlugs: string[];
  /** Cosa è stato fatto (dryRun=false) o cosa si FAREBBE (dryRun=true). */
  actions: ReconcileAction[];
};

/** Iscrizione ACTIVE con i campi campagna serviti alla riconciliazione. */
type ActiveEnrollmentRow = {
  id: string;
  campaignId: string;
  campaign: { key: string; targetServiceSlug: string; priority: number };
};

/**
 * Cliente per la riconciliazione: consenso + stato relazione. `relationshipState`
 * è opzionale così i chiamanti batch che passano solo i campi di consenso restano
 * compatibili; nel path DB viene sempre caricato (vedi select in reconcile).
 */
export type ReconcilableClient = EmailableClient & {
  relationshipState?: ClientRelationshipState;
};

export type ReconcileOptions = {
  clientId: string;
  /** Default true: NON scrive nel DB, ritorna solo cosa farebbe. */
  dryRun?: boolean;
  now?: Date;
  /**
   * Dati pre-caricati per l'uso in batch (cron), per evitare N+1. Se assenti
   * vengono letti dal DB.
   */
  ctx?: {
    client?: ReconcilableClient;
    ownedSlugs?: Set<string>;
    activeEnrollments?: ActiveEnrollmentRow[];
    activeCampaigns?: EligibilityCampaign[];
  };
};

/**
 * PROPAGAZIONE: allinea le iscrizioni del cliente alla sua situazione attuale.
 *
 * Ordine di valutazione:
 *  (a) ogni iscrizione ACTIVE il cui `targetServiceSlug` è ORA posseduto → CONVERTED
 *      (convertedAt=now, exitReason="servizio acquisito");
 *  (b) se il cliente NON è più contattabile OPPURE è EX_CLIENTE (churn) → tutte le
 *      iscrizioni ACTIVE residue → SUPPRESSED e NESSUN arruolamento (le campagne
 *      cross-sell valgono solo per clienti correnti);
 *  (c) se non resta alcuna iscrizione ACTIVE ed è idoneo a una campagna → arruola alla
 *      più prioritaria (in dryRun NON scrive: segnala solo cosa farebbe);
 *  (d) se ha un'iscrizione ACTIVE ma esiste una campagna a priorità MAGGIORE per cui è
 *      idoneo → NESSUNA preemption automatica (si evita churn): viene solo segnalato.
 *
 * In dryRun (default) NON tocca il DB. Con dryRun=false esegue le transizioni in
 * un'unica transazione. NON invia email in nessun caso (Fase 0).
 */
export async function reconcileClientEnrollments(opts: ReconcileOptions): Promise<ReconcileResult> {
  const { clientId } = opts;
  const dryRun = opts.dryRun ?? true;
  const now = opts.now ?? new Date();

  // --- Caricamento dati (o riuso di quelli passati dal cron) ---
  const client =
    opts.ctx?.client ??
    (await prisma.client.findUnique({
      where: { id: clientId },
      select: { marketingConsentBasis: true, marketingOptOutAt: true, relationshipState: true },
    }));
  if (!client) {
    return { clientId, dryRun, emailable: false, ownedSlugs: [], actions: [{ type: "NOOP", reason: "cliente inesistente" }] };
  }

  const ownedSlugs = opts.ctx?.ownedSlugs ?? (await loadOwnedSlugs(clientId));
  const activeEnrollments = opts.ctx?.activeEnrollments ?? (await loadActiveEnrollments(clientId));
  const activeCampaigns = opts.ctx?.activeCampaigns ?? (await loadActiveCampaigns());

  const emailable = isCampaignEmailable(client);
  // EX_CLIENTE = churn: non è più cliente attivo, quindi esce da tutte le campagne
  // cross-sell (che sono pensate per la base clienti corrente).
  const isExClient = client.relationshipState === "EX_CLIENTE";
  const actions: ReconcileAction[] = [];

  // Transizioni da applicare (se non dryRun).
  const toConvert: string[] = [];
  const toSuppress: string[] = [];
  // Motivo di uscita per le soppressioni (dipende dalla causa: consenso o churn).
  let suppressReason = "consenso mancante o disiscritto";
  let toEnroll: EligibilityCampaign | null = null;

  // (a) Conversioni: target ora posseduto.
  const stillActive: ActiveEnrollmentRow[] = [];
  for (const en of activeEnrollments) {
    if (ownedSlugs.has(en.campaign.targetServiceSlug)) {
      toConvert.push(en.id);
      actions.push({
        type: "CONVERT",
        enrollmentId: en.id,
        campaignKey: en.campaign.key,
        reason: "servizio acquisito",
      });
    } else {
      stillActive.push(en);
    }
  }

  // (b) Soppressione se non più contattabile OPPURE non più cliente (EX_CLIENTE).
  if (!emailable || isExClient) {
    // Churn ha precedenza informativa sul consenso nella motivazione d'uscita.
    suppressReason = isExClient ? "non più cliente" : "consenso mancante o disiscritto";
    for (const en of stillActive) {
      toSuppress.push(en.id);
      actions.push({
        type: "SUPPRESS",
        enrollmentId: en.id,
        campaignKey: en.campaign.key,
        reason: suppressReason,
      });
    }
  } else if (stillActive.length === 0) {
    // (c) Nessuna iscrizione ACTIVE residua ⇒ eventuale arruolamento alla top.
    const pick = pickCampaignForClient(ownedSlugs, activeCampaigns);
    if (pick) {
      toEnroll = pick;
      actions.push({
        type: "ENROLL",
        campaignId: pick.id,
        campaignKey: pick.key,
        reason: "idoneo, nessuna iscrizione attiva",
      });
    } else {
      actions.push({ type: "NOOP", reason: "nessuna campagna idonea" });
    }
  } else {
    // (d) Ha già un'iscrizione ACTIVE: nessuna preemption, solo segnalazione se
    //     esiste una campagna idonea a priorità maggiore (più bassa).
    const best = pickCampaignForClient(ownedSlugs, activeCampaigns);
    const current = stillActive.reduce((min, e) => Math.min(min, e.campaign.priority), Infinity);
    if (best && best.priority < current) {
      const currentKey = stillActive.find((e) => e.campaign.priority === current)?.campaign.key ?? "?";
      actions.push({
        type: "HIGHER_PRIORITY_AVAILABLE",
        currentCampaignKey: currentKey,
        betterCampaignKey: best.key,
      });
    } else {
      actions.push({ type: "NOOP", reason: "iscrizione attiva mantenuta" });
    }
  }

  // --- Esecuzione (solo se non dryRun) ---
  if (!dryRun && (toConvert.length || toSuppress.length || toEnroll)) {
    await prisma.$transaction(async (tx) => {
      if (toConvert.length) {
        await tx.campaignEnrollment.updateMany({
          where: { id: { in: toConvert }, status: "ACTIVE" },
          data: { status: "CONVERTED", convertedAt: now, exitReason: "servizio acquisito", nextStepAt: null },
        });
      }
      if (toSuppress.length) {
        await tx.campaignEnrollment.updateMany({
          where: { id: { in: toSuppress }, status: "ACTIVE" },
          data: { status: "SUPPRESSED", exitedAt: now, exitReason: suppressReason, nextStepAt: null },
        });
      }
      if (toEnroll) {
        // Guardia idempotenza applicativa: non duplicare un'iscrizione ACTIVE alla
        // stessa campagna. È l'ultima operazione della transazione, così un eventuale
        // errore catturato più sotto non lascia query pendenti nella tx.
        const existing = await tx.campaignEnrollment.findFirst({
          where: { clientId, campaignId: toEnroll.id, status: "ACTIVE" },
          select: { id: true },
        });
        if (!existing) {
          try {
            await tx.campaignEnrollment.create({
              data: {
                clientId,
                campaignId: toEnroll.id,
                status: "ACTIVE",
                enrolledAt: now,
                currentStepIndex: 0,
                nextStepAt: now, // lo step 0 è valutato da computeDueSends (delayDays dall'iscrizione)
                simulated: true,
              },
            });
          } catch (e) {
            // Difesa DB: l'indice unico parziale `CampaignEnrollment_active_unique`
            // (migration 20260727120000) garantisce una sola iscrizione ACTIVE per
            // (clientId, campaignId) anche in caso di race con la findFirst qui sopra.
            // Se scatta il vincolo (P2002) l'iscrizione esiste già ⇒ no-op idempotente,
            // non far fallire il batch. Ogni altro errore viene ri-sollevato.
            if (!isUniqueConstraintError(e)) throw e;
          }
        }
      }
    });
  }

  return { clientId, dryRun, emailable, ownedSlugs: Array.from(ownedSlugs), actions };
}

// ---------------------------------------------------------------------------
// Schedulazione degli invii (Fase 0: SIMULATED)
// ---------------------------------------------------------------------------

/** Piano di invio calcolato per un'iscrizione ACTIVE (funzione PURA). */
export type DueSendPlan = {
  /** True se lo step corrente è dovuto (dueAt <= now). */
  due: boolean;
  /** Step corrente da inviare (se dovuto). */
  step: SchedulableStep | null;
  stepIndex: number;
  /** Momento in cui lo step corrente diventa/è diventato dovuto. */
  dueAt: Date | null;
  /** Indice del prossimo step dopo questo (null se non esiste). */
  nextStepIndex: number | null;
  /** Momento del prossimo step (null se non esiste). */
  nextStepAt: Date | null;
  /** True se, inviato lo step corrente, l'iscrizione è COMPLETED. */
  completesAfterSend: boolean;
  /** True se non ci sono più step da inviare (già completata). */
  completed: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** dueAt di uno step = enrolledAt + delayDays (giorni dall'iscrizione, vedi schema). */
function stepDueAt(enrolledAt: Date, step: SchedulableStep): Date {
  return new Date(enrolledAt.getTime() + step.delayDays * DAY_MS);
}

/**
 * Calcola se è dovuto il prossimo step per un'iscrizione ACTIVE, in base a
 * `enrolledAt + step.delayDays` vs `now`. NON scrive nel DB: ritorna il piano.
 * L'esecuzione (creazione CampaignSend SIMULATED + avanzamento) è in `applyDueSend`.
 */
export function computeDueSends(params: {
  enrollment: SchedulableEnrollment;
  steps: SchedulableStep[];
  now?: Date;
}): DueSendPlan {
  const { enrollment } = params;
  const now = params.now ?? new Date();
  const steps = [...params.steps].sort((a, b) => a.stepIndex - b.stepIndex);

  const step = steps.find((s) => s.stepIndex === enrollment.currentStepIndex) ?? null;
  if (!step) {
    // Nessuno step a questo indice ⇒ tutti gli step sono passati.
    return {
      due: false, step: null, stepIndex: enrollment.currentStepIndex, dueAt: null,
      nextStepIndex: null, nextStepAt: null, completesAfterSend: false, completed: true,
    };
  }

  const dueAt = stepDueAt(enrollment.enrolledAt, step);
  const idx = steps.findIndex((s) => s.stepIndex === step.stepIndex);
  const next = steps[idx + 1] ?? null;

  return {
    due: dueAt.getTime() <= now.getTime(),
    step,
    stepIndex: step.stepIndex,
    dueAt,
    nextStepIndex: next ? next.stepIndex : null,
    nextStepAt: next ? stepDueAt(enrollment.enrolledAt, next) : null,
    completesAfterSend: next == null,
    completed: false,
  };
}

/** Esito dell'esecuzione di un invio dovuto. */
export type ApplyDueSendResult = {
  enrollmentId: string;
  action:
    | "SIMULATED_SEND"
    | "COMPLETED"
    | "SKIPPED_NOT_DUE"
    | "SKIPPED_ALREADY_SENT"
    | "SKIPPED_NOT_EMAILABLE";
  stepIndex: number | null;
  sendStatus?: CampaignSendStatus;
};

/**
 * Risolve la contattabilità del cliente AL MOMENTO DELL'INVIO. In batch il cron
 * può passare i dati via `ctx` (nessuna query); altrimenti si legge il consenso
 * del cliente dell'iscrizione dal DB. Fail-safe: se il cliente non è risolvibile
 * ritorna false (non si invia).
 */
async function resolveEmailableForSend(
  enrollmentId: string,
  ctx?: { client?: EmailableClient; emailable?: boolean },
): Promise<boolean> {
  if (typeof ctx?.emailable === "boolean") return ctx.emailable;
  if (ctx?.client) return isCampaignEmailable(ctx.client);
  const row = await prisma.campaignEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { client: { select: { marketingConsentBasis: true, marketingOptOutAt: true } } },
  });
  if (!row?.client) return false;
  return isCampaignEmailable(row.client);
}

/**
 * Esegue (o simula, se dryRun) l'invio dovuto per un'iscrizione ACTIVE:
 *  - RI-VERIFICA il consenso al momento dell'invio (difesa in profondità): se il
 *    cliente non è (più) contattabile NON invia e sopprime l'iscrizione,
 *  - crea un `CampaignSend` con status SIMULATED (Fase 0, nessuna email reale),
 *  - avanza `currentStepIndex`/`nextStepAt`,
 *  - se non ci sono più step ⇒ iscrizione COMPLETED.
 * In dryRun NON scrive: ritorna solo cosa farebbe.
 *
 * `ctx` permette al cron di passare consenso già caricato (niente query nel batch).
 */
export async function applyDueSend(params: {
  enrollment: SchedulableEnrollment;
  steps: SchedulableStep[];
  now?: Date;
  dryRun?: boolean;
  /** Consenso pre-caricato per evitare query nel path batch (vedi resolveEmailableForSend). */
  ctx?: { client?: EmailableClient; emailable?: boolean };
}): Promise<ApplyDueSendResult> {
  const { enrollment } = params;
  const now = params.now ?? new Date();
  const dryRun = params.dryRun ?? true;
  const plan = computeDueSends({ enrollment, steps: params.steps, now });

  if (plan.completed) {
    if (!dryRun) {
      await prisma.campaignEnrollment.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { status: "COMPLETED", exitedAt: now, exitReason: "sequenza conclusa", nextStepAt: null },
      });
    }
    return { enrollmentId: enrollment.id, action: "COMPLETED", stepIndex: null };
  }

  if (!plan.due || !plan.step) {
    return { enrollmentId: enrollment.id, action: "SKIPPED_NOT_DUE", stepIndex: plan.stepIndex };
  }

  // --- DIFESA IN PROFONDITÀ: consenso RI-VERIFICATO al momento dell'invio ---
  // Non ci si fida del solo stato dell'iscrizione: anche se un opt-out non fosse
  // stato propagato all'iscrizione, qui l'email non parte. Se il cliente non è più
  // contattabile → NIENTE invio e iscrizione SUPPRESSED (in dryRun si segnala solo).
  // La guardia vale anche in Fase 0 (SIMULATED) per pulizia dei dati.
  const emailable = await resolveEmailableForSend(enrollment.id, params.ctx);
  if (!emailable) {
    if (!dryRun) {
      await prisma.campaignEnrollment.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: {
          status: "SUPPRESSED",
          exitedAt: now,
          exitReason: "consenso mancante al momento dell'invio",
          nextStepAt: null,
        },
      });
    }
    return { enrollmentId: enrollment.id, action: "SKIPPED_NOT_EMAILABLE", stepIndex: plan.stepIndex };
  }

  if (dryRun) {
    return {
      enrollmentId: enrollment.id,
      action: "SIMULATED_SEND",
      stepIndex: plan.stepIndex,
      sendStatus: "SIMULATED",
    };
  }

  const step = plan.step;
  const result = await prisma.$transaction(async (tx) => {
    // Idempotenza: non ri-creare un invio già presente per questo step.
    const already = await tx.campaignSend.findFirst({
      where: { enrollmentId: enrollment.id, stepIndex: step.stepIndex },
      select: { id: true },
    });
    if (already) {
      return { action: "SKIPPED_ALREADY_SENT" as const };
    }

    await tx.campaignSend.create({
      data: {
        enrollmentId: enrollment.id,
        stepId: step.id,
        stepIndex: step.stepIndex,
        status: "SIMULATED",
        trackToken: randomBytes(24).toString("base64url"),
        scheduledFor: plan.dueAt ?? now,
        // Fase 0: nessun sentAt reale (l'email non parte).
      },
    });

    if (plan.completesAfterSend) {
      await tx.campaignEnrollment.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { status: "COMPLETED", currentStepIndex: step.stepIndex + 1, exitedAt: now, exitReason: "sequenza conclusa", nextStepAt: null },
      });
    } else {
      await tx.campaignEnrollment.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { currentStepIndex: plan.nextStepIndex ?? step.stepIndex + 1, nextStepAt: plan.nextStepAt },
      });
    }
    return { action: "SIMULATED_SEND" as const };
  });

  return {
    enrollmentId: enrollment.id,
    action: result.action,
    stepIndex: step.stepIndex,
    sendStatus: result.action === "SIMULATED_SEND" ? "SIMULATED" : undefined,
  };
}

// ---------------------------------------------------------------------------
// Loader DB (riusabili; il cron può pre-caricare e passare via ctx)
// ---------------------------------------------------------------------------

/** Campagne ACTIVE (campi di idoneità) ordinate per priorità crescente. */
export async function loadActiveCampaigns(): Promise<EligibilityCampaign[]> {
  return prisma.crossSellCampaign.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true, key: true, status: true, priority: true,
      targetServiceSlug: true, requiresAnyOwnedSlug: true, excludesOwnedSlug: true,
    },
    orderBy: { priority: "asc" },
  });
}

/** Iscrizioni ACTIVE del cliente con i campi campagna per la riconciliazione. */
export async function loadActiveEnrollments(clientId: string): Promise<ActiveEnrollmentRow[]> {
  return prisma.campaignEnrollment.findMany({
    where: { clientId, status: "ACTIVE" },
    select: {
      id: true,
      campaignId: true,
      campaign: { select: { key: true, targetServiceSlug: true, priority: true } },
    },
  });
}

/** Slug posseduti dal cliente (delega a ownership.ts per coerenza). */
async function loadOwnedSlugs(clientId: string): Promise<Set<string>> {
  const { getOwnedServiceSlugs } = await import("@/lib/campaigns/ownership");
  return getOwnedServiceSlugs(clientId);
}

/** Campagna idonea per la vista scheda cliente (simulazione). */
export type EligibleCampaignView = {
  campaignId: string;
  campaignName: string;
  targetServiceSlug: string;
  priority: number;
  status: CampaignStatus;
  reason: string | null;
};

/**
 * Idoneità per la scheda cliente (SIMULAZIONE): a differenza di
 * `eligibleCampaignsForClient` (che considera solo le ACTIVE, usata dalla
 * riconciliazione reale), qui valuta anche le campagne in BOZZA/PAUSA — così in
 * Fase 0 si vede cosa scatterebbe una volta attivate. Ordinate per priorità.
 */
export async function getEligibleCampaignsForClientId(clientId: string): Promise<EligibleCampaignView[]> {
  const [owned, campaigns] = await Promise.all([
    loadOwnedSlugs(clientId),
    prisma.crossSellCampaign.findMany({
      where: { status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } },
      select: {
        id: true, name: true, status: true, priority: true,
        targetServiceSlug: true, requiresAnyOwnedSlug: true, excludesOwnedSlug: true,
      },
      orderBy: { priority: "asc" },
    }),
  ]);
  return campaigns
    .filter((c) =>
      !owned.has(c.targetServiceSlug) &&
      !c.excludesOwnedSlug.some((s) => owned.has(s)) &&
      (c.requiresAnyOwnedSlug.length === 0 || c.requiresAnyOwnedSlug.some((s) => owned.has(s))),
    )
    .map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      targetServiceSlug: c.targetServiceSlug,
      priority: c.priority,
      status: c.status,
      reason: c.status !== "ACTIVE" ? "in bozza — si attiverà quando accendi la campagna" : null,
    }));
}
