import type { DigitalAuditSectionKey } from "@prisma/client";
import { digitalAuditSectionLabel } from "@/lib/digital-audit-labels";

export type AuditOutreachKit = {
  linkedInBody: string;
  callScript: string;
  whatsAppBody: string;
};

export type AuditOutreachSectionInput = {
  sectionKey: DigitalAuditSectionKey;
  score: number;
  issues?: string | null;
};

function weakestSections(sections: AuditOutreachSectionInput[], limit = 3): AuditOutreachSectionInput[] {
  return [...sections].sort((a, b) => a.score - b.score).slice(0, limit);
}

export function buildAuditOutreachKit(params: {
  businessName: string;
  overallScore: number | null;
  priorityProblem: string | null;
  brandName?: string | null;
  serviceName?: string | null;
  sections: AuditOutreachSectionInput[];
}): AuditOutreachKit {
  const name = params.businessName.trim() || "la vostra azienda";
  const score = params.overallScore ?? 0;
  const problem =
    params.priorityProblem?.trim() ||
    "migliorare la visibilità digitale e convertire meglio il traffico locale";
  const offer =
    params.brandName && params.serviceName
      ? `${params.brandName} — ${params.serviceName}`
      : params.serviceName ?? params.brandName ?? "un percorso marketing mirato";

  const weak = weakestSections(params.sections);
  const weakBullets = weak
    .map((s) => `• ${digitalAuditSectionLabel[s.sectionKey]} (${s.score}/100)`)
    .join("\n");

  const linkedInBody = `Ciao,

ho analizzato la presenza digitale di ${name} (punteggio sintetico ${score}/100).

Emergono margini su:
${weakBullets || "• presenza online generale"}

In particolare: ${problem}.

Propongo ${offer} con obiettivi misurabili in 60–90 giorni.

Se ti va, ti mando un report sintetico e fissiamo 15 minuti questa settimana.

A presto`;

  const callScript = `SCRIPT CALL — ${name}
────────────────────────
1. Apertura (30s)
   "Buongiorno, sono [nome] di Onizuka. Ho completato un audit digitale sulla vostra presenza online — posso condividere 2 insight rapidi?"

2. Contesto (45s)
   "Il punteggio complessivo è circa ${score} su 100. Il gap principale che vediamo è: ${problem}."

3. Prove (60s)
   ${weak.length ? weak.map((s) => `   - ${digitalAuditSectionLabel[s.sectionKey]}: ${s.score}/100 — ${s.issues?.split(".")[0] ?? "da ottimizzare"}`).join("\n   ") : "   - Verificare sito, local SEO e recensioni."}

4. Proposta (45s)
   "Il pacchetto che consigliamo è ${offer}: interventi prioritari senza dispersione."

5. Chiusura (30s)
   "Preferite una call di 20 minuti martedì o giovedì? Posso inviarvi il report pubblico via link."

Obiezione budget → "Partiamo da quick win su ${weak[0] ? digitalAuditSectionLabel[weak[0].sectionKey] : "local"} con KPI chiari."
Obiezione timing → "Il report resta valido 30 giorni; possiamo fissare solo un debrief."`;

  // Messaggio WhatsApp: breve, diretto, tono colloquiale (da usare se si ottiene il numero del titolare).
  const whatsAppBody = `Buongiorno 👋 sono Lorenzo di Online Station.

Ho dato un'occhiata alla presenza online di ${name} e ho preparato una breve analisi gratuita (punteggio ${score}/100).

Il punto principale su cui si può migliorare: ${problem}.

Se le fa piacere le giro il report e ci sentiamo 10 minuti, senza impegno. Va bene?`;

  return { linkedInBody, callScript, whatsAppBody };
}
