import { prisma } from "@/lib/prisma";
import { buildOutreachDraftFromSequenceStep } from "@/lib/reach-sequence-draft";
import { notifyAdminsViaTelegram, type TelegramInlineKeyboard } from "@/lib/telegram-bot";
import { ITALY_TZ } from "@/lib/datetime-it";

export type SequenceStepTemplate = {
  delayDays: number;
  subject: string;
  body: string;
  subjectAlt?: string;
  bodyAlt?: string;
};

export const DEFAULT_AUDIT_SEQUENCE_DELAYS = [0, 3, 7, 14, 30] as const;

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function buildAuditSequenceSteps(params: {
  companyName: string;
  firstSubject: string;
  firstBody: string;
  priorityProblem?: string | null;
}): SequenceStepTemplate[] {
  const problem = params.priorityProblem?.trim() ?? "migliorare la presenza digitale";
  return [
    { delayDays: 0, subject: params.firstSubject, body: params.firstBody },
    {
      delayDays: 3,
      subject: `Re: opportunità per ${params.companyName}`,
      body: `Buongiorno,

ti scrivo un breve follow-up sul messaggio di qualche giorno fa.

Resta valida l'opportunità su ${problem.toLowerCase()}: se ti va, in 15 minuti ti mostro le priorità e cosa cambierebbe in pratica per ${params.companyName}.

Dimmi pure un paio di slot e mi organizzo io.

Cordiali saluti,
Lorenzo Matarazzo · Online Station`,
    },
    {
      delayDays: 7,
      subject: `Un'idea concreta per ${params.companyName}`,
      body: `Buongiorno,

riprendo il filo con uno spunto pratico: intervenendo su ${problem.toLowerCase()} si possono recuperare contatti che oggi vanno persi.

Abbiamo preparato un'analisi dettagliata della vostra presenza online: se vuoi te la giro e ne parliamo insieme, senza impegno.

Quando preferisci?

Cordiali saluti,
Lorenzo Matarazzo · Online Station`,
    },
    {
      delayDays: 14,
      subject: `${params.companyName}: i risultati ottenibili`,
      body: `Buongiorno,

molte attività come la vostra, sistemando ${problem.toLowerCase()}, hanno aumentato richieste e contatti in poche settimane.

Mi piacerebbe mostrarvi, dati alla mano, cosa si può ottenere nel vostro caso specifico. Bastano 15 minuti, anche al telefono.

Vi va questa settimana o la prossima?

Cordiali saluti,
Lorenzo Matarazzo · Online Station`,
    },
    {
      delayDays: 30,
      subject: `Chiudo qui, ma resto a disposizione — ${params.companyName}`,
      body: `Buongiorno,

questo è il mio ultimo messaggio, per non risultare insistente.

Se anche solo in futuro vorrete migliorare ${problem.toLowerCase()}, basta un vostro "sì" e organizzo subito una consulenza gratuita con il report già pronto.

Vi lascio il mio contatto diretto. Grazie e a presto,
Lorenzo Matarazzo · Online Station`,
    },
  ];
}

async function persistOutreachSequence(params: {
  ownerUserId: string;
  clientId?: string | null;
  leadId?: string | null;
  digitalAuditId?: string | null;
  name: string;
  firstDraftId: string;
  templates: SequenceStepTemplate[];
}): Promise<string> {
  const start = new Date();

  const sequence = await prisma.outreachSequence.create({
    data: {
      ownerUserId: params.ownerUserId,
      clientId: params.clientId ?? undefined,
      leadId: params.leadId ?? undefined,
      digitalAuditId: params.digitalAuditId ?? undefined,
      name: params.name,
      status: "ACTIVE",
      steps: {
        create: params.templates.map((t, stepIndex) => ({
          stepIndex,
          delayDays: t.delayDays,
          subject: t.subject,
          subjectAlt: t.subjectAlt?.trim() || undefined,
          body: t.body,
          bodyAlt: t.bodyAlt?.trim() || undefined,
          scheduledFor: addDays(start, t.delayDays),
          status: stepIndex === 0 ? "ACTIVATED" : "SCHEDULED",
          activatedAt: stepIndex === 0 ? new Date() : undefined,
        })),
      },
    },
    include: { steps: { orderBy: { stepIndex: "asc" } } },
  });

  const step0 = sequence.steps.find((s) => s.stepIndex === 0);
  if (step0) {
    await prisma.outreachDraft.update({
      where: { id: params.firstDraftId },
      data: { sequenceStepId: step0.id },
    });
    await prisma.outreachSequenceStep.update({
      where: { id: step0.id },
      data: { status: "ACTIVATED", activatedAt: new Date() },
    });
  }

  return sequence.id;
}

/** Sequenza J+0/J+3/J+7 su cliente senza audit (prima bozza in approvazione). */
export async function createManualClientOutreachSequence(params: {
  ownerUserId: string;
  clientId: string;
  priorityProblem?: string | null;
  templates?: SequenceStepTemplate[];
}): Promise<{ sequenceId: string; draftId: string }> {
  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, companyName: true },
  });
  if (!client) throw new Error("Cliente non trovato");

  const problem = params.priorityProblem?.trim() || "migliorare la presenza digitale";
  const subject = `Opportunità per ${client.companyName}`;
  const templates =
    params.templates ??
    buildAuditSequenceSteps({
    companyName: client.companyName,
    firstSubject: subject,
    firstBody: `Buongiorno,

vorrei condividere un'idea su come ${problem.toLowerCase()} per ${client.companyName}.

Se ti fa comodo, possiamo fissare una breve call senza impegno.

Cordiali saluti,
Lorenzo Matarazzo`,
    priorityProblem: problem,
  });

  const draft = await prisma.outreachDraft.create({
    data: {
      ownerUserId: params.ownerUserId,
      clientId: client.id,
      subject: templates[0].subject,
      subjectAlt: templates[0].subjectAlt?.trim() || null,
      body: templates[0].body,
      bodyAlt: templates[0].bodyAlt?.trim() || null,
      status: "PENDING_APPROVAL",
    },
  });

  const sequenceId = await persistOutreachSequence({
    ownerUserId: params.ownerUserId,
    clientId: client.id,
    name: `Follow-up · ${client.companyName}`,
    firstDraftId: draft.id,
    templates,
  });

  return { sequenceId, draftId: draft.id };
}

/** Sequenza J+0/J+3/J+7 su lead CRM (senza cliente convertito). */
export async function createManualLeadOutreachSequence(params: {
  ownerUserId: string;
  leadId: string;
  priorityProblem?: string | null;
  templates?: SequenceStepTemplate[];
}): Promise<{ sequenceId: string; draftId: string }> {
  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, ownerUserId: params.ownerUserId },
    select: { id: true, title: true, businessName: true, contactName: true },
  });
  if (!lead) throw new Error("Lead non trovato");

  const companyName = lead.businessName?.trim() || lead.title;
  const problem = params.priorityProblem?.trim() || "migliorare la presenza digitale";
  const subject = `Opportunità per ${companyName}`;
  const templates =
    params.templates ??
    buildAuditSequenceSteps({
      companyName,
      firstSubject: subject,
      firstBody: `Buongiorno${lead.contactName ? ` ${lead.contactName}` : ""},

vorrei condividere un'idea su come ${problem.toLowerCase()} per ${companyName}.

Se ti fa comodo, possiamo fissare una breve call senza impegno.

Cordiali saluti,
Lorenzo Matarazzo`,
      priorityProblem: problem,
    });

  const draft = await prisma.outreachDraft.create({
    data: {
      ownerUserId: params.ownerUserId,
      leadId: lead.id,
      subject: templates[0].subject,
      subjectAlt: templates[0].subjectAlt?.trim() || null,
      body: templates[0].body,
      bodyAlt: templates[0].bodyAlt?.trim() || null,
      status: "PENDING_APPROVAL",
    },
  });

  const sequenceId = await persistOutreachSequence({
    ownerUserId: params.ownerUserId,
    clientId: null,
    leadId: lead.id,
    name: `Follow-up lead · ${companyName}`,
    firstDraftId: draft.id,
    templates,
  });

  return { sequenceId, draftId: draft.id };
}

/** Crea sequenza post-audit collegata alla bozza iniziale (step 0). */
export async function createAuditOutreachSequence(params: {
  ownerUserId: string;
  clientId: string;
  digitalAuditId: string;
  companyName: string;
  firstDraftId: string;
  firstSubject: string;
  firstBody: string;
  priorityProblem?: string | null;
}): Promise<string> {
  const templates = buildAuditSequenceSteps({
    companyName: params.companyName,
    firstSubject: params.firstSubject,
    firstBody: params.firstBody,
    priorityProblem: params.priorityProblem,
  });

  return persistOutreachSequence({
    ownerUserId: params.ownerUserId,
    clientId: params.clientId,
    digitalAuditId: params.digitalAuditId,
    name: `Post-audit · ${params.companyName}`,
    firstDraftId: params.firstDraftId,
    templates,
  });
}

export async function activateSequenceStep(stepId: string): Promise<{ draftId: string } | null> {
  const step = await prisma.outreachSequenceStep.findUnique({
    where: { id: stepId },
    include: {
      sequence: {
        include: {
          client: { select: { companyName: true } },
          lead: { select: { title: true, businessName: true } },
        },
      },
    },
  });

  if (!step || step.status !== "SCHEDULED") return null;
  if (step.sequence.status !== "ACTIVE") return null;

  const built = await buildOutreachDraftFromSequenceStep(step.sequence.ownerUserId, {
    subject: step.subject,
    subjectAlt: step.subjectAlt,
    body: step.body,
    bodyAlt: step.bodyAlt,
  });

  const draft = await prisma.outreachDraft.create({
    data: {
      ownerUserId: step.sequence.ownerUserId,
      clientId: step.sequence.clientId,
      leadId: step.sequence.leadId,
      digitalAuditId: step.sequence.digitalAuditId,
      sequenceStepId: step.id,
      subject: built.draftFields.subject,
      subjectAlt: built.draftFields.subjectAlt,
      body: built.draftFields.body,
      bodyAlt: built.draftFields.bodyAlt,
      status: "PENDING_APPROVAL",
    },
  });

  await prisma.outreachSequenceStep.update({
    where: { id: stepId },
    data: { status: "ACTIVATED", activatedAt: new Date() },
  });

  const company =
    step.sequence.client?.companyName ??
    step.sequence.lead?.businessName?.trim() ??
    step.sequence.lead?.title ??
    "Cliente";

  // Auto-invio dei follow-up: la 1ª mail (step 0) resta sempre con approvazione
  // manuale; gli step J+3+ partono da soli, ma SOLO se la prima è stata davvero
  // inviata (altrimenti un "ti ricontatto" senza primo contatto non ha senso).
  const firstStep = await prisma.outreachSequenceStep.findFirst({
    where: { sequenceId: step.sequenceId, stepIndex: 0 },
    select: { status: true },
  });
  const eligibleForAutoSend = step.stepIndex >= 1 && firstStep?.status === "SENT";

  if (eligibleForAutoSend) {
    const { sendOutreachDraftNow } = await import("@/lib/outreach-send");
    const result = await sendOutreachDraftNow(draft.id);
    if (result.sent) {
      // Notifica informativa (niente approvazione): solo lo Stop a portata di mano.
      await notifyAdminsViaTelegram(
        [
          "Onizuka · Follow-up inviato in automatico",
          "",
          `Cliente: ${company}`,
          `Step: ${step.stepIndex + 1} (J+${step.delayDays})`,
          `Oggetto (${built.variant}): ${built.previewSubject}`,
          result.to ? `Inviato a: ${result.to}` : "",
        ].filter(Boolean).join("\n"),
        { inline_keyboard: [[{ text: "🛑 Stop follow-up", callback_data: `os:${draft.id}` }]] }
      );
      return { draftId: draft.id };
    }
    // Auto-invio non riuscito (es. nessuna email/canale): degrado ad approvazione manuale.
  }

  const keyboard: TelegramInlineKeyboard = {
    inline_keyboard: [
      [
        { text: "Approva", callback_data: `oa:${draft.id}` },
        { text: "Modifica", callback_data: `oe:${draft.id}` },
        { text: "Rimanda", callback_data: `op:${draft.id}` },
      ],
      [{ text: "🛑 Stop follow-up", callback_data: `os:${draft.id}` }],
    ],
  };

  await notifyAdminsViaTelegram(
    [
      "Onizuka · Follow-up sequenza",
      "",
      `Cliente: ${company}`,
      `Step: ${step.stepIndex + 1} (J+${step.delayDays})`,
      `Oggetto (${built.variant}): ${built.previewSubject}`,
      "",
      "Bozza in attesa di approvazione in Reach.",
    ].join("\n"),
    keyboard
  );

  return { draftId: draft.id };
}

export async function processDueOutreachSequenceSteps(): Promise<{
  activated: number;
  completedSequences: number;
  skippedWeekend?: boolean;
}> {
  const now = new Date();

  // Orario umano: niente follow-up nel weekend (ora Italia). Gli step restano
  // SCHEDULED e partono al primo giorno feriale utile → più credibilità/consegna.
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: ITALY_TZ, weekday: "short" }).format(now);
  if (weekday === "Sat" || weekday === "Sun") {
    return { activated: 0, completedSequences: 0, skippedWeekend: true };
  }

  const due = await prisma.outreachSequenceStep.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
      sequence: { status: "ACTIVE" },
    },
    take: 20,
    orderBy: { scheduledFor: "asc" },
  });

  let activated = 0;
  for (const step of due) {
    const result = await activateSequenceStep(step.id);
    if (result) activated += 1;
  }

  const activeSequences = await prisma.outreachSequence.findMany({
    where: { status: "ACTIVE" },
    include: { steps: true },
  });

  let completedSequences = 0;
  for (const seq of activeSequences) {
    const hasPending = seq.steps.some((s) => s.status === "SCHEDULED" || s.status === "ACTIVATED");
    const allTerminal = seq.steps.every((s) =>
      ["SENT", "SKIPPED", "CANCELLED"].includes(s.status)
    );
    if (allTerminal && !hasPending) {
      await prisma.outreachSequence.update({
        where: { id: seq.id },
        data: { status: "COMPLETED" },
      });
      // Sequenza conclusa restando ACTIVE = nessuna risposta (una risposta l'avrebbe
      // messa in PAUSED). Il lead satellite passa a "freddo/nurturing" invece di
      // restare LEAD attivo all'infinito.
      if (seq.leadId) {
        await prisma.lead
          .updateMany({
            where: { id: seq.leadId, status: { notIn: ["CONVERTED", "LOST"] } },
            data: { status: "COLD" },
          })
          .catch(() => undefined);
      } else if (seq.clientId) {
        await prisma.lead
          .updateMany({
            where: { clientId: seq.clientId, status: { notIn: ["CONVERTED", "LOST"] } },
            data: { status: "COLD" },
          })
          .catch(() => undefined);
      }
      completedSequences += 1;
    }
  }

  return { activated, completedSequences };
}

/** Segna step come SENT quando la bozza collegata viene inviata. */
export async function markSequenceStepSentByDraftId(draftId: string): Promise<void> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: { sequenceStepId: true },
  });
  if (!draft?.sequenceStepId) return;

  await prisma.outreachSequenceStep.update({
    where: { id: draft.sequenceStepId },
    data: { status: "SENT" },
  });
}
