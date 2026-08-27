import { prisma } from "@/lib/prisma";
import { nomeCommerciale } from "@/lib/nome-commerciale";
import { sweepStaleOutreach } from "@/lib/outreach-hygiene";
import { isHardBounced } from "@/lib/outreach-bounce";
import { isAutoSendAllowed } from "@/lib/outreach-send-cap";
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

/**
 * J+0 / J+3 / J+7 e basta. I passi a 14 e 30 giorni sono stati tolti (25/08):
 * senza rilevamento affidabile delle risposte su OGNI canale, un "ti riscrivo
 * dopo un mese" a chi magari ha già risposto è il modo più costoso di farsi
 * segnalare come spam. Tre tocchi in una settimana bastano; chi non risponde
 * passa a freddo e si ricontatta con una campagna, non con l'insistenza.
 */
export const DEFAULT_AUDIT_SEQUENCE_DELAYS = [0, 3, 7] as const;

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
  /** Non più usato nei follow-up: incollare una stringa-diagnosi in una frase
   *  («l'opportunità su presenza social debole o incoerente») dichiarava
   *  l'automatismo. I seguiti rimandano all'analisi, non ai suoi campi. */
  priorityProblem?: string | null;
}): SequenceStepTemplate[] {
  // Nome commerciale applicato QUI, a monte: qualunque chiamante passi la
  // ragione sociale da visura, il follow-up non la stampa. Un nome di persona
  // o un segnaposto non è un'insegna: si passa al generico.
  const nc = nomeCommerciale(params.companyName);
  const generico = !nc.nome || nc.isPersona || /^la vostra (attività|azienda)$/i.test(nc.nome);
  const nome = generico ? "" : nc.nome;
  const suffisso = nome ? ` — ${nome}` : "";
  const diChi = nome ? `di ${nome}` : "della vostra attività";

  // Riscritti il 26/08 (revisione copy): il vecchio J+3 aveva il «Re:» finto,
  // il tu e il voi nella stessa frase e il gergo da agenzia (follow-up, slot).
  // La seconda impressione deve valere quanto la prima.
  return [
    { delayDays: 0, subject: params.firstSubject, body: params.firstBody },
    {
      delayDays: 3,
      subject: `Torno un attimo da voi${suffisso}`,
      body: `Buongiorno,

vi ho scritto qualche giorno fa a proposito della presenza online ${diChi} — capisco le giornate piene, quindi due righe soltanto.

L'analisi che avevo preparato per voi è ancora qui, pronta: dentro c'è anche la cosa che sistemerei per prima, quella che rende di più con meno sforzo.

Se vi va di vederla, basta un «sì» in risposta. Senza impegno.

Cordiali saluti,
Lorenzo Matarazzo · Online Station — Rosignano Solvay`,
    },
    {
      delayDays: 7,
      subject: `Ultimo messaggio, promesso${suffisso}`,
      body: `Buongiorno,

questo è l'ultimo messaggio che vi mando: non voglio essere insistente.

L'analisi gratuita della vostra presenza online resta a disposizione — se un giorno vorrete vederla, basta rispondere a questa mail e ve la mostro, con le priorità da cui partirei.

E se passate da Rosignano, ci trovate in Via Vecchia Aurelia 393, il negozio TIM e Fastweb: un caffè e due consigli non si negano a nessuno.

Buon lavoro,
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
          client: { select: { companyName: true, contactEmail: true } },
          lead: { select: { title: true, businessName: true, email: true } },
        },
      },
    },
  });

  if (!step || step.status !== "SCHEDULED") return null;
  if (step.sequence.status !== "ACTIVE") return null;

  // Recapito gia' rimbalzato in modo permanente: lo step si chiude qui, senza
  // creare una bozza che nessuno potra' mai spedire (ne' sprecare l'attenzione
  // di chi approva). Vedi outreach-bounce.ts.
  const recapito = [step.sequence.client?.contactEmail, step.sequence.lead?.email]
    .map((e) => e?.trim())
    .find((e) => e && !/@onizuka[.]local$/i.test(e));
  if (recapito && (await isHardBounced(recapito))) {
    await prisma.outreachSequenceStep.updateMany({
      where: { id: stepId, status: "SCHEDULED" },
      data: { status: "SKIPPED" },
    });
    return null;
  }

  // Claim atomico: solo un run "vince" SCHEDULED→ACTIVATED. Senza, due esecuzioni
  // sovrapposte del cron creerebbero due bozze (e due invii) per lo stesso step.
  const claimed = await prisma.outreachSequenceStep.updateMany({
    where: { id: stepId, status: "SCHEDULED" },
    data: { status: "ACTIVATED", activatedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const built = await buildOutreachDraftFromSequenceStep(step.sequence.ownerUserId, {
    subject: step.subject,
    subjectAlt: step.subjectAlt,
    body: step.body,
    bodyAlt: step.bodyAlt,
  });

  // Uno step può avere UNA sola bozza agganciata (unique su sequenceStepId), ma
  // una bozza VECCHIA — cancellata dall'igiene o sostituita da una rigenerazione —
  // resta agganciata e occupa il posto: la create nuova esplodeva con "Unique
  // constraint failed" e (fino al fix del loop qui sotto) uccideva l'intero cron.
  // È il crash osservato il 24/08 e il 26/08. La bozza storica si sgancia e resta
  // in archivio con la sua nota; il posto torna libero. Le SENT non si toccano:
  // uno step con bozza inviata non arriva qui (status SENT, non SCHEDULED).
  await prisma.outreachDraft.updateMany({
    where: { sequenceStepId: step.id, status: { not: "SENT" } },
    data: { sequenceStepId: null },
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

  // Tetto giornaliero: protegge il dominio dalla macchina, non da Lorenzo.
  // Gli invii manuali non passano di qui e restano liberi. Se il tetto è
  // raggiunto la bozza resta pronta e riparte domani: non si perde nulla.
  const capGate = eligibleForAutoSend
    ? await isAutoSendAllowed(step.sequence.ownerUserId)
    : { allowed: false as const, reason: "" };

  if (eligibleForAutoSend && capGate.allowed) {
    const { sendOutreachDraftNow } = await import("@/lib/outreach-send");
    const result = await sendOutreachDraftNow(draft.id, { auto: true });
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

  // La notifica porta il TESTO INTEGRALE: da Telegram si decide se approvare o
  // modificare, e senza corpo non si decide niente (richiesta di Lorenzo del
  // 26/08, primo giorno di bozze). Il tetto Telegram è 4096: teniamo margine.
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
  const recipient =
    [step.sequence.client?.contactEmail, step.sequence.lead?.email].find(
      (e) => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !/@onizuka\.local$/i.test(e)
    ) ?? null;
  const bodyFull = built.draftFields.body ?? "";
  const bodyShown = bodyFull.length > 3200 ? `${bodyFull.slice(0, 3200)}\n[…testo troncato: apri la bozza]` : bodyFull;

  await notifyAdminsViaTelegram(
    [
      step.stepIndex === 0
        ? "✉️ Onizuka · PRIMA MAIL da approvare"
        : `Onizuka · Follow-up sequenza (J+${step.delayDays})`,
      "",
      `Cliente: ${company}`,
      recipient ? `A: ${recipient}` : "⚠️ Senza email valida (Approva non invierà)",
      `Oggetto (${built.variant}): ${built.previewSubject}`,
      built.draftFields.subjectAlt ? `Oggetto (B): ${built.draftFields.subjectAlt}` : "",
      "",
      "──────────",
      bodyShown,
      "──────────",
      "",
      `👉 Modifica o dettagli: ${base}/admin/reach?draft=${draft.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    keyboard
  );

  return { draftId: draft.id };
}

export async function processDueOutreachSequenceSteps(): Promise<{
  activated: number;
  /** Step la cui attivazione è fallita: il giro prosegue, ma il numero si vede. */
  activationFailed?: number;
  completedSequences: number;
  skippedWeekend?: boolean;
  hygiene?: { stepsSkipped: number; draftsCancelled: number };
}> {
  const now = new Date();

  // --- MANUTENZIONE: sempre, anche nel weekend ---
  // Non manda niente, quindi non ha motivo di fermarsi il sabato. Prima stava
  // dopo il controllo del weekend e per due giorni su sette l'arretrato
  // continuava a crescere indisturbato.

  // Scadenza degli step "ACTIVATED" mai inviati (bozza manuale mai approvata):
  // oltre la soglia diventano SKIPPED, altrimenti la sequenza non si chiude mai
  // e il lead non passa mai a freddo.
  const STALE_ACTIVATED_MS = 10 * 86_400_000;
  await prisma.outreachSequenceStep.updateMany({
    where: { status: "ACTIVATED", activatedAt: { lt: new Date(now.getTime() - STALE_ACTIVATED_MS) } },
    data: { status: "SKIPPED" },
  });

  // Scadenza degli step SCHEDULED e delle bozze mai approvate: e' la regola che
  // mancava del tutto, quella per cui un passo previsto per il 4 giugno restava
  // "dovuto" a fine luglio e sarebbe partito al primo sblocco degli invii.
  const hygiene = await sweepStaleOutreach(now);

  // Orario umano: niente follow-up nel weekend (ora Italia). Gli step restano
  // SCHEDULED e partono al primo giorno feriale utile → più credibilità/consegna.
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: ITALY_TZ, weekday: "short" }).format(now);
  if (weekday === "Sat" || weekday === "Sun") {
    return { activated: 0, completedSequences: 0, skippedWeekend: true, hygiene };
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

  // Uno step marcio non deve più fermare tutti gli altri: il 26/08 un solo
  // conflitto sulla prima attivazione ha buttato via l'intero giro (e con lui
  // ogni notifica Telegram del mattino). Si continua, si conta, si riferisce.
  let activated = 0;
  let failed = 0;
  for (const step of due) {
    try {
      const result = await activateSequenceStep(step.id);
      if (result) activated += 1;
    } catch (e) {
      failed += 1;
      console.error(`[reach-sequences] step ${step.id} fallito:`, e instanceof Error ? e.message : e);
    }
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

  return { activated, activationFailed: failed, completedSequences, hygiene };
}

/** Segna step come SENT quando la bozza collegata viene inviata. */
export async function markSequenceStepSentByDraftId(draftId: string): Promise<void> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: { sequenceStepId: true },
  });
  if (!draft?.sequenceStepId) return;

  const step = await prisma.outreachSequenceStep.update({
    where: { id: draft.sequenceStepId },
    data: { status: "SENT" },
    select: { sequenceId: true, stepIndex: true, delayDays: true },
  });

  // RI-ANCORAGGIO: i ritardi valgono dal giorno dell'INVIO REALE, non dal
  // giorno in cui la sequenza fu programmata. Senza questo, una prima mail
  // approvata con calma aveva il J+3 già scaduto e il follow-up partiva il
  // giorno dopo: due mail in due giorni, l'opposto del ritmo promesso.
  const sentAt = new Date();
  const successivi = await prisma.outreachSequenceStep.findMany({
    where: {
      sequenceId: step.sequenceId,
      stepIndex: { gt: step.stepIndex },
      status: "SCHEDULED",
    },
    select: { id: true, delayDays: true },
  });
  for (const s of successivi) {
    const delta = Math.max(1, (s.delayDays ?? 0) - (step.delayDays ?? 0));
    await prisma.outreachSequenceStep.update({
      where: { id: s.id },
      data: { scheduledFor: addDays(sentAt, delta) },
    });
  }
}
