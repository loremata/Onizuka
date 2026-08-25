/**
 * RIGENERAZIONE MIRATA — solo chi possiamo davvero contattare, col messaggio giusto.
 *
 * La fotografia del 25/08: 854 sequenze attive che rigeneravano bozze per lead
 * SENZA email (poi scartate dall'igiene, all'infinito), e 268 prospect con email
 * vera fermi in mezzo al mucchio. Questo script mette ordine una volta sola:
 *
 *  1. Sequenze il cui destinatario NON ha un'email reale → CANCELLED (la loro
 *     strada è WhatsApp/telefono, non una coda email che non partirà mai).
 *  2. Sequenze con email reale → prima mail riscritta per SEGMENTO:
 *       A · senza sito  → proposta diretta con prezzi chiari (197 € espresso,
 *                         da 749 € su misura) + fatti dalla scheda Google;
 *       B · con sito    → analisi evidence-based col metodo nuovo (solo fatti
 *                         misurati) + link al report.
 *     Follow-up J+3/J+7 riscritti col nome commerciale pulito; i passi J+14/J+30
 *     (non esistono più nel ritmo nuovo) → SKIPPED.
 *  3. Le prime mail vengono SCAGLIONATE (15 per giorno feriale): il cron ne
 *     attiva un lotto al giorno → bozze in approvazione a ritmo sostenibile,
 *     niente code che scadono prima di essere lette.
 *
 * Ogni testo passa da validateOutreachDraft PRIMA di essere scritto: quello che
 * non regge la lettura non entra in coda.
 *
 * Default a SECCO. Scrive solo con --applica:
 *   npx tsx scripts/rigenera-outreach-mirata.ts             → prova
 *   npx tsx scripts/rigenera-outreach-mirata.ts --applica   → scrive
 */

import { PrismaClient } from "@prisma/client";
import { buildFirstAuditOutreachEmail } from "../src/lib/audit-outreach-draft";
import {
  buildEvidenceFindings,
  parseMetrics,
  isNonSito,
  piattaformaDi,
  metricheSenzaSito,
} from "../src/lib/audit-evidence";
import { nomeCommerciale } from "../src/lib/nome-commerciale";
import { buildAuditSequenceSteps } from "../src/lib/outreach-sequence";
import { validateOutreachDraft, describeOutreachQuality } from "../src/lib/outreach-quality";

const prisma = new PrismaClient();
const APPLICA = process.argv.includes("--applica");

/** Prime mail per giorno feriale: allineato al ritmo di approvazione umano. */
const LOTTO_GIORNALIERO = 15;

const emailReale = (e?: string | null) =>
  !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !/@onizuka\.local$/i.test(e);

/** Il prossimo giorno feriale alle 9:00, saltando sabato e domenica. */
function giornoFeriale(base: Date, avanti: number): Date {
  const d = new Date(base);
  d.setHours(9, 0, 0, 0);
  let rimasti = avanti;
  while (rimasti > 0 || d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) rimasti -= 1;
  }
  return d;
}

/** Segmento A: niente sito → proposta diretta, prezzi in chiaro, zero fumo. */
function mailSenzaSito(params: {
  nome: string;
  isPersona: boolean;
  gbpFatti: string[];
  piattaforma: string | null;
  reportUrl: string;
}): { subject: string; subjectAlt: string; body: string } {
  const chi = params.isPersona ? "la vostra attività" : params.nome;
  const apertura = params.piattaforma
    ? `cercando ${chi} online ho trovato ${params.piattaforma}, ma non un sito vostro.`
    : `cercando ${chi} online ho trovato i vostri riferimenti, ma non un sito vostro.`;
  const fatti = params.gbpFatti.length
    ? `\nDue cose che ho notato sulla vostra presenza online:\n${params.gbpFatti
        .slice(0, 2)
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : "";

  return {
    subject: `${params.isPersona ? "Un sito per la vostra attività" : `${params.nome}: chi vi cerca online non trova un vostro sito`}`,
    subjectAlt: `Un sito ${params.isPersona ? "per la vostra attività" : `per ${params.nome}`}: online in 24 ore, da 197 €`,
    body: `Buongiorno,

${apertura} Oggi chi cerca un'attività come la vostra confronta due o tre risultati su Google — e sceglie quasi sempre chi un sito ce l'ha.
${fatti}
Siamo Online Station, a Rosignano Solvay: il negozio TIM e Fastweb sulla vecchia Aurelia, con una squadra che fa siti per le attività della zona. Prezzi chiari, senza sorprese:
- sito espresso, online in 24 ore: 197 €;
- sito professionale su misura: da 749 €.

Ho preparato anche una breve analisi gratuita della vostra presenza online: ${params.reportUrl}

Se vi interessa, rispondete a questa mail o scriveteci su WhatsApp al 327 377 7737: vi diciamo cosa serve davvero, senza impegno.

Cordiali saluti,
Lorenzo Matarazzo · Online Station · onlinestation.it`,
  };
}

async function main() {
  const sequenze = await prisma.outreachSequence.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] }, digitalAuditId: { not: null } },
    select: {
      id: true,
      status: true,
      client: { select: { id: true, contactEmail: true, phone: true } },
      lead: { select: { id: true, email: true, phone: true } },
      digitalAudit: {
        select: {
          id: true,
          businessName: true,
          website: true,
          priorityProblem: true,
          metricsJson: true,
          gbpRating: true,
          gbpReviewCount: true,
          publicReportToken: true,
          overallScore: true,
        },
      },
      steps: {
        select: { id: true, stepIndex: true, status: true, delayDays: true },
        orderBy: { stepIndex: "asc" },
      },
    },
  });
  console.log(
    `${sequenze.length} sequenze da esaminare · modalità ${APPLICA ? "SCRITTURA" : "prova a secco"}\n`
  );

  type Pronta = {
    seqId: string;
    step0Id: string;
    followUp: { id: string; stepIndex: number }[];
    daSkippare: string[];
    subject: string;
    subjectAlt: string | null;
    body: string;
    followTemplates: { stepIndex: number; subject: string; body: string }[];
    haTelefono: boolean;
    score: number;
    segmento: "A" | "B";
  };

  const pronte: Pronta[] = [];
  let daChiudere: string[] = [];
  let giaInviate = 0,
    senzaAudit = 0,
    scarti = 0;
  const motiviScarto = new Map<string, number>();

  for (const s of sequenze) {
    const a = s.digitalAudit;
    if (!a || !a.publicReportToken) {
      senzaAudit++;
      continue;
    }
    const step0 = s.steps.find((p) => p.stepIndex === 0);
    if (!step0 || step0.status === "SENT") {
      giaInviate++;
      continue;
    }

    // La prima email REALE vince, da qualunque record: il client satellite ha
    // spesso il segnaposto mentre l'email vera sta sul Lead (Sheet/form P.IVA).
    const dest = [s.client?.contactEmail, s.lead?.email].find(emailReale) ?? null;
    if (!dest) {
      daChiudere.push(s.id);
      continue;
    }

    const terzi = isNonSito(a.website);
    const metriche = terzi ? metricheSenzaSito(parseMetrics(a.metricsJson)) : parseMetrics(a.metricsJson);
    const findings = buildEvidenceFindings(metriche);
    const conSito = metriche?.hasWebsite === true;
    const pulito = nomeCommerciale(a.businessName);
    // «Prospect P.IVA 01887…» non è un nome: è il segnaposto dell'anagrafica.
    // Trattarlo come persona (→ "la vostra attività") invece di stamparlo.
    const nomeSegnaposto = /\bprospect\s+p\.?\s*iva\b|\bp\.?\s*iva\s+\d{6,}/i.test(pulito.nome);
    const nome = nomeSegnaposto ? "" : pulito.nome;
    const isPersona = pulito.isPersona || nomeSegnaposto;
    const reportUrl = `https://onizuka.it/report/${a.publicReportToken}`;

    let subject: string, subjectAlt: string | null, body: string, problemFollow: string;
    let segmento: "A" | "B";
    if (!conSito) {
      segmento = "A";
      const m = mailSenzaSito({
        nome,
        isPersona,
        gbpFatti: findings.map((f) => f.gap),
        piattaforma: terzi ? piattaformaDi(a.website) : null,
        reportUrl,
      });
      subject = m.subject;
      subjectAlt = m.subjectAlt;
      body = m.body;
      problemFollow = "avere un sito che porti clienti";
    } else {
      segmento = "B";
      const m = buildFirstAuditOutreachEmail({
        companyName: a.businessName ?? "",
        priorityProblem: a.priorityProblem ?? "",
        findings,
        hasWebsite: true,
        piattaformaTerzi: null,
        gbpReviewCount: a.gbpReviewCount,
        gbpRating: a.gbpRating == null ? null : Number(a.gbpRating),
        reportUrl,
      });
      subject = m.subject;
      subjectAlt = m.subjectAlt ?? null;
      body = m.body;
      problemFollow = a.priorityProblem?.trim() || "migliorare la presenza online";
    }

    // La stessa guardia dell'invio, ma a monte: quello che non regge non entra in coda.
    const q = validateOutreachDraft({ subject, body });
    if (!q.ok) {
      scarti++;
      const motivo = q.problems[0]?.code ?? "altro";
      motiviScarto.set(motivo, (motiviScarto.get(motivo) ?? 0) + 1);
      continue;
    }

    // Follow-up J+3/J+7 col nome pulito e col problema del segmento.
    const followTemplates = buildAuditSequenceSteps({
      companyName: isPersona ? "la vostra attività" : nome,
      firstSubject: subject,
      firstBody: body,
      priorityProblem: problemFollow,
    })
      .slice(1)
      .map((t, i) => ({ stepIndex: i + 1, subject: t.subject, body: t.body }));

    pronte.push({
      seqId: s.id,
      step0Id: step0.id,
      followUp: s.steps
        .filter((p) => p.stepIndex >= 1 && p.stepIndex <= 2 && p.status !== "SENT")
        .map((p) => ({ id: p.id, stepIndex: p.stepIndex })),
      daSkippare: s.steps.filter((p) => p.stepIndex >= 3 && p.status !== "SENT").map((p) => p.id),
      subject,
      subjectAlt,
      body,
      followTemplates,
      haTelefono: !!(s.client?.phone || s.lead?.phone),
      score: a.overallScore ?? 100,
      segmento,
    });
  }

  // Priorità: prima chi ha anche il telefono (doppio canale), poi punteggio
  // peggiore (più bisogno, argomento più forte).
  pronte.sort((x, y) => Number(y.haTelefono) - Number(x.haTelefono) || x.score - y.score);

  const perSegmento = { A: pronte.filter((p) => p.segmento === "A").length, B: pronte.filter((p) => p.segmento === "B").length };
  console.log(`pronte da rigenerare:   ${pronte.length}  (A senza sito: ${perSegmento.A} · B restyling: ${perSegmento.B})`);
  console.log(`  con telefono (doppio canale): ${pronte.filter((p) => p.haTelefono).length}`);
  console.log(`da chiudere (niente email → WhatsApp/telefono): ${daChiudere.length}`);
  console.log(`già inviate (intoccate): ${giaInviate} · senza audit/report: ${senzaAudit}`);
  const motiviTxt = Array.from(motiviScarto.entries())
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  console.log(`scartate dalla qualità: ${scarti}${scarti ? ` → ${motiviTxt}` : ""}`);
  const giorni = Math.ceil(pronte.length / LOTTO_GIORNALIERO);
  console.log(`scaglionamento: ${LOTTO_GIORNALIERO}/giorno feriale → ~${giorni} giorni lavorativi\n`);

  if (!APPLICA) {
    if (pronte[0]) {
      console.log("── ANTEPRIMA prima mail in coda ──");
      console.log(`Oggetto: ${pronte[0].subject}`);
      console.log(pronte[0].body.slice(0, 600));
    }
    console.log("\nprova a secco: non è stato scritto niente. Rilancia con --applica.");
    return;
  }

  // 1 · Chiusura delle sequenze non contattabili + nota sulle loro bozze pendenti.
  if (daChiudere.length) {
    await prisma.outreachSequence.updateMany({
      where: { id: { in: daChiudere } },
      data: { status: "CANCELLED" },
    });
    await prisma.outreachSequenceStep.updateMany({
      where: { sequenceId: { in: daChiudere }, status: { in: ["SCHEDULED", "ACTIVATED"] } },
      data: { status: "SKIPPED" },
    });
    await prisma.outreachDraft.updateMany({
      where: {
        status: { in: ["PENDING_APPROVAL", "DRAFT"] },
        sequenceStep: { sequenceId: { in: daChiudere } },
      },
      data: {
        status: "CANCELLED",
        statusNote: "Sequenza chiusa: il lead non ha un'email — lavorabile solo via WhatsApp o telefono",
      },
    });
  }

  // 2 · Rigenerazione scaglionata.
  const oggi = new Date();
  let i = 0;
  for (const p of pronte) {
    const dataStep0 = giornoFeriale(oggi, Math.floor(i / LOTTO_GIORNALIERO));
    i += 1;

    // Le bozze pendenti dei vecchi step diventano storia dichiarata, non muta.
    await prisma.outreachDraft.updateMany({
      where: {
        status: { in: ["PENDING_APPROVAL", "DRAFT"] },
        sequenceStep: { sequenceId: p.seqId },
      },
      data: { status: "CANCELLED", statusNote: "Sostituita dalla rigenerazione mirata del 25/08 (copy per segmento)" },
    });

    await prisma.outreachSequence.update({ where: { id: p.seqId }, data: { status: "ACTIVE" } });
    await prisma.outreachSequenceStep.update({
      where: { id: p.step0Id },
      data: {
        subject: p.subject,
        subjectAlt: p.subjectAlt,
        body: p.body,
        status: "SCHEDULED",
        scheduledFor: dataStep0,
        activatedAt: null,
      },
    });
    for (const f of p.followUp) {
      const t = p.followTemplates.find((x) => x.stepIndex === f.stepIndex);
      const quando = new Date(dataStep0);
      quando.setDate(quando.getDate() + (f.stepIndex === 1 ? 3 : 7));
      await prisma.outreachSequenceStep.update({
        where: { id: f.id },
        data: {
          ...(t ? { subject: t.subject, body: t.body } : {}),
          status: "SCHEDULED",
          scheduledFor: quando,
          activatedAt: null,
        },
      });
    }
    if (p.daSkippare.length) {
      await prisma.outreachSequenceStep.updateMany({
        where: { id: { in: p.daSkippare } },
        data: { status: "SKIPPED" },
      });
    }
  }

  console.log(`APPLICATO: ${pronte.length} sequenze rigenerate, ${daChiudere.length} chiuse.`);
  console.log("Verifica sul DB, non su questo log: conta step0 SCHEDULED con scheduledFor >= oggi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
