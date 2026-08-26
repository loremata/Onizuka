/**
 * Riscrive le mail di outreach degli audit già a sistema con il metodo nuovo.
 *
 * NON rifà l'audit: le metriche grezze (HTTPS, form di contatto, tracciamento,
 * scheda Google) sono già salvate in `metricsJson`. Quello che era sbagliato
 * non era la raccolta, era il racconto — le frasi venivano da una tabella fissa
 * che non guardava mai i dati. Quindi si ricalcola solo il testo: nessuna
 * chiamata di rete, nessun consumo di quota PageSpeed o Google Places.
 *
 * Cosa cambia su ogni riga:
 *  - i punti nascono dalle metriche misurate e citano un numero verificabile;
 *  - se le metriche non dicono niente, la mail resta sul solo dato certo
 *    invece di inventare tre problemi plausibili;
 *  - le pagine di terzi (Facebook, portali) non sono più spacciate per sito, e
 *    le metriche raccolte su quelle pagine vengono neutralizzate;
 *  - il nome dell'azienda viene ripulito dalla forma da visura camerale.
 *
 * Tocca solo i passi ANCORA DA MANDARE (SCHEDULED e ACTIVATED). Quelli già
 * inviati o scaduti restano come sono: sono storia, non vanno riscritti.
 *
 * Default a SECCO: stampa cosa cambierebbe senza toccare niente.
 *   npx tsx scripts/rigenera-outreach-audit.ts            → prova
 *   npx tsx scripts/rigenera-outreach-audit.ts --applica  → scrive
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

const prisma = new PrismaClient();
const APPLICA = process.argv.includes("--applica");

async function main() {
  const audits = await prisma.digitalAudit.findMany({
    select: {
      id: true, businessName: true, website: true, priorityProblem: true, metricsJson: true,
      gbpRating: true, gbpReviewCount: true, publicReportToken: true, leadId: true,
    },
  });
  console.log(`${audits.length} audit da rielaborare · modalità ${APPLICA ? "SCRITTURA" : "prova a secco"}\n`);

  let riscritti = 0, saltati = 0, terziCorretti = 0, senzaFatti = 0, linkMancante = 0;

  for (const a of audits) {
    // Tutti i passi della sequenza, non solo quelli in coda.
    //
    // Le prime mail sono TUTTE scadute senza partire (1.065 SKIPPED, 1 SENT) e
    // in coda sono rimasti solo i follow-up: se partissero, 854 aziende
    // riceverebbero un «come da mia precedente» senza aver mai ricevuto la
    // precedente. Quindi la prima mail va riaperta, e i seguiti rimessi dopo
    // di lei.
    // Non solo le sequenze ACTIVE: anche quelle in altri stati possono avere
    // una prima mail ancora in coda, e con il testo vecchio. Nel primo giro ne
    // erano rimaste fuori 16, tutte con il link al report monco.
    const seq = await prisma.outreachSequence.findFirst({
      where: { digitalAuditId: a.id, status: { not: "CANCELLED" } },
      select: { id: true, steps: { select: { id: true, stepIndex: true, status: true, delayDays: true } } },
    });
    if (!seq) { saltati++; continue; }
    const primoPasso = seq.steps.find((p) => p.stepIndex === 0);
    const giaInviata = primoPasso?.status === "SENT";
    if (giaInviata) { saltati++; continue; }

    const terzi = isNonSito(a.website);
    if (terzi) terziCorretti++;
    const metriche = terzi ? metricheSenzaSito(parseMetrics(a.metricsJson)) : parseMetrics(a.metricsJson);
    const findings = buildEvidenceFindings(metriche);
    if (!findings.length) senzaFatti++;

    // Il link al report è il pezzo che, se manca, brucia il contatto da solo.
    if (!a.publicReportToken) { linkMancante++; continue; }

    const mail = buildFirstAuditOutreachEmail({
      companyName: a.businessName ?? "",
      priorityProblem: a.priorityProblem ?? "",
      findings,
      hasWebsite: metriche?.hasWebsite === true,
      piattaformaTerzi: terzi ? piattaformaDi(a.website) : null,
      gbpReviewCount: a.gbpReviewCount,
      gbpRating: a.gbpRating == null ? null : Number(a.gbpRating),
    });

    // Guardia: non scrivere mai una mail con il link monco o senza corpo.
    if (!mail.body.includes(a.publicReportToken) || mail.body.trim().length < 200) { linkMancante++; continue; }

    if (APPLICA) {
      const oggi = new Date();
      // La prima mail torna in coda col testo nuovo, pronta da approvare.
      if (primoPasso) {
        await prisma.outreachSequenceStep.update({
          where: { id: primoPasso.id },
          data: {
            subject: mail.subject,
            subjectAlt: mail.subjectAlt ?? null,
            body: mail.body,
            status: "SCHEDULED",
            scheduledFor: oggi,
            activatedAt: null,
          },
        });
      }
      // I follow-up ripartono da oggi secondo il loro ritardo, così nessuno
      // arriva prima della mail che dovrebbe seguire.
      for (const f of seq.steps.filter((p) => p.stepIndex > 0 && p.status !== "SENT")) {
        const quando = new Date(oggi);
        quando.setDate(quando.getDate() + (f.delayDays ?? 7 * f.stepIndex));
        await prisma.outreachSequenceStep.update({
          where: { id: f.id },
          data: { status: "SCHEDULED", scheduledFor: quando, activatedAt: null },
        });
      }
    }
    riscritti++;
  }

  console.log(`riscritti:            ${riscritti}`);
  console.log(`senza passi da mandare: ${saltati}`);
  console.log(`pagine di terzi corrette: ${terziCorretti}`);
  console.log(`senza fatti verificabili (mail sul solo dato certo): ${senzaFatti}`);
  console.log(`scartati per link mancante o corpo troppo corto: ${linkMancante}`);
  if (!APPLICA) console.log("\nprova a secco: non è stato scritto niente. Rilancia con --applica.");
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
