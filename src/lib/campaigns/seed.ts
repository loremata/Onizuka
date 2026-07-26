/**
 * Seed idempotente delle campagne cross-sell (upsert per `key`).
 *
 * Le campagne vengono create in status DRAFT: NON arruolano nessuno finché
 * Lorenzo non le attiva manualmente (ACTIVE) e non accende gli invii (Fase 1).
 *
 * Registro copy: utile, concreto, offerta chiara e tono POSITIVO. Nessuna
 * opzione fa sembrare peggiore un altro servizio o operatore: si differenzia su
 * COSA aggiunge / QUANDO e PER CHI ha senso, mai su "meglio/peggio".
 *
 * `delayDays` = giorni dall'iscrizione (offset assoluto, coerente con l'engine).
 */

import { prisma } from "@/lib/prisma";

type StepSeed = { stepIndex: number; delayDays: number; subject: string; body: string };

type CampaignSeed = {
  key: string;
  name: string;
  description: string;
  priority: number;
  targetServiceSlug: string;
  requiresAnyOwnedSlug: string[];
  excludesOwnedSlug: string[];
  steps: StepSeed[];
};

export const CROSS_SELL_CAMPAIGNS: CampaignSeed[] = [
  {
    key: "fibra-casa",
    name: "Fibra casa per chi ha già il mobile",
    description: "Propone la fibra ai clienti con linea mobile attiva.",
    priority: 10,
    targetServiceSlug: "fiber",
    requiresAnyOwnedSlug: ["mobile"],
    excludesOwnedSlug: ["fiber"],
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        subject: "La tua linea di casa, dallo stesso referente di fiducia",
        body:
          "Ciao! Hai già il mobile con noi e sei sempre a posto.\n\n" +
          "Quando vorrai completare la connettività di casa o dell'attività, la fibra la gestiamo insieme al tuo mobile: un unico referente, una sola gestione, tutto in negozio.\n\n" +
          "Se ti fa comodo, passa a trovarci o rispondi a questa email: ti prepariamo la soluzione su misura.",
      },
      {
        stepIndex: 1,
        delayDays: 4,
        subject: "Fibra + mobile: connessione stabile, gestione semplice",
        body:
          "Un promemoria veloce: con la fibra abbinata al tuo mobile hai connessione stabile a casa e assistenza da chi già conosci.\n\n" +
          "Ti diciamo in due minuti copertura e condizioni per il tuo indirizzo. Quando vuoi ci siamo.",
      },
      {
        stepIndex: 2,
        delayDays: 10,
        subject: "Quando vuoi, la fibra è pronta per te",
        body:
          "Ultimo messaggio su questo: la proposta fibra resta valida quando ti sarà comoda.\n\n" +
          "Basta un tuo cenno e la attiviamo con la stessa semplicità del tuo mobile. Grazie della fiducia!",
      },
    ],
  },
  {
    key: "mobile-tim",
    name: "Mobile per chi ha già la fibra",
    description: "Propone una linea mobile ai clienti con connettività fissa attiva.",
    priority: 20,
    targetServiceSlug: "mobile",
    requiresAnyOwnedSlug: ["fiber"],
    excludesOwnedSlug: ["mobile"],
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        subject: "Una linea mobile abbinata alla tua fibra",
        body:
          "Ciao! Hai già la connettività fissa con noi.\n\n" +
          "Se vuoi, una linea mobile abbinata semplifica gestione e fatturazione: un unico interlocutore per casa e telefono.\n\n" +
          "Passa in negozio o rispondi qui: vediamo insieme la soluzione più adatta ai tuoi consumi.",
      },
      {
        stepIndex: 1,
        delayDays: 5,
        subject: "Fibra e mobile, tutto in un posto solo",
        body:
          "Piccolo promemoria: con fibra e mobile insieme hai una gestione più semplice e la stessa assistenza di sempre.\n\n" +
          "Ti prepariamo un'offerta tarata su come usi il telefono. Quando vuoi ci trovi qui.",
      },
    ],
  },
  {
    key: "tim-energia",
    name: "Energia (luce e gas) per clienti telco",
    description: "Propone luce, e poi gas, ai clienti con mobile e fibra attivi.",
    priority: 30,
    targetServiceSlug: "energy",
    requiresAnyOwnedSlug: ["mobile", "fiber"],
    excludesOwnedSlug: ["energy"],
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        subject: "Anche la luce, dallo stesso punto di fiducia",
        body:
          "Ciao! Gestisci già telefono e connettività con noi.\n\n" +
          "Il passo naturale è riunire anche la fornitura luce nello stesso posto: una gestione sola, un referente solo, tutto in negozio.\n\n" +
          "Portaci una bolletta recente e ti mostriamo la soluzione adatta a te.",
      },
      {
        stepIndex: 1,
        delayDays: 6,
        subject: "Luce e gas insieme: utenze riunite, gestione semplice",
        body:
          "Se ti fa comodo, oltre alla luce possiamo seguire anche il gas: così le utenze di casa sono tutte nello stesso punto.\n\n" +
          "Ti facciamo un quadro chiaro in pochi minuti. Quando vuoi passa a trovarci.",
      },
      {
        stepIndex: 2,
        delayDays: 12,
        subject: "La tua energia, quando vuoi tu",
        body:
          "Ultimo promemoria: la proposta energia resta pronta quando ti sarà comoda.\n\n" +
          "Un tuo cenno e mettiamo tutto in ordine insieme, con la semplicità di sempre.",
      },
    ],
  },
  {
    key: "tim-vision",
    name: "TIM Vision per chi ha la fibra",
    description: "Propone l'intrattenimento TV ai clienti con fibra attiva.",
    priority: 40,
    targetServiceSlug: "tim-vision",
    requiresAnyOwnedSlug: ["fiber"],
    excludesOwnedSlug: ["tim-vision", "tv"],
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        subject: "Con la tua fibra, l'intrattenimento è pronto",
        body:
          "Ciao! Hai già la fibra con noi: la connessione c'è.\n\n" +
          "Se ti piace guardare film, serie e sport comodamente da casa, TIM Vision aggiunge l'intrattenimento sfruttando la linea che hai già.\n\n" +
          "Te lo mostriamo in negozio quando passi.",
      },
      {
        stepIndex: 1,
        delayDays: 7,
        subject: "Film, serie e sport sulla connessione che hai già",
        body:
          "Un promemoria veloce: con TIM Vision hai l'intrattenimento di casa senza pensieri, sulla tua fibra.\n\n" +
          "Quando vuoi te lo facciamo provare. Ci trovi qui.",
      },
    ],
  },
  {
    key: "timfin",
    name: "Soluzioni di pagamento dilazionato",
    description: "Propone il finanziamento dedicato ai clienti telco consolidati.",
    priority: 50,
    targetServiceSlug: "timfin",
    requiresAnyOwnedSlug: ["mobile", "fiber"],
    excludesOwnedSlug: ["timfin"],
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        subject: "Il tuo prossimo dispositivo, a rate comode",
        body:
          "Ciao! Sei un cliente di fiducia e volevamo dirti una cosa utile.\n\n" +
          "Quando vorrai cambiare smartphone o dispositivo, puoi dilazionare la spesa in rate comode: prendi ciò che ti serve senza pesare tutto in una volta.\n\n" +
          "Passa in negozio e vediamo insieme le condizioni adatte a te.",
      },
      {
        stepIndex: 1,
        delayDays: 6,
        subject: "Rate comode quando ti serve un nuovo dispositivo",
        body:
          "Piccolo promemoria: la possibilità di rateizzare è a tua disposizione quando ti servirà.\n\n" +
          "Nessuna fretta: quando decidi, ti spieghiamo tutto con chiarezza in negozio.",
      },
    ],
  },
  {
    key: "telepass",
    name: "Telepass per clienti multi-servizio",
    description: "Propone Telepass ai clienti con mobile, fibra ed energia attivi.",
    priority: 60,
    targetServiceSlug: "telepass",
    requiresAnyOwnedSlug: ["mobile", "fiber", "energy"],
    excludesOwnedSlug: ["telepass"],
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        subject: "Telepass: una comodità in più per i tuoi spostamenti",
        body:
          "Ciao! Gestisci già più servizi con noi e ti ringraziamo per la fiducia.\n\n" +
          "Se ti sposti spesso, Telepass aggiunge comodità quotidiana: caselli e parcheggi senza pensieri, con attivazione rapida in negozio.\n\n" +
          "Quando passi te lo attiviamo in pochi minuti.",
      },
      {
        stepIndex: 1,
        delayDays: 8,
        subject: "Attivazione rapida in negozio, quando vuoi",
        body:
          "Un promemoria veloce: Telepass è pronto quando ti farà comodo, con attivazione semplice allo sportello.\n\n" +
          "Ci trovi qui quando vuoi. Grazie ancora!",
      },
    ],
  },
];

export type SeedCampaignResult = { key: string; created: boolean; steps: number };

/**
 * Crea/aggiorna le campagne cross-sell (upsert per key) e i relativi step
 * (upsert per campaignId+stepIndex). Idempotente. Status forzato a DRAFT.
 */
export async function seedCrossSellCampaigns(): Promise<SeedCampaignResult[]> {
  const results: SeedCampaignResult[] = [];

  for (const c of CROSS_SELL_CAMPAIGNS) {
    const existing = await prisma.crossSellCampaign.findUnique({ where: { key: c.key }, select: { id: true } });

    const campaign = await prisma.crossSellCampaign.upsert({
      where: { key: c.key },
      update: {
        name: c.name,
        description: c.description,
        priority: c.priority,
        channel: "EMAIL",
        // Status DRAFT: non riattiviamo automaticamente una campagna che Lorenzo
        // potrebbe aver messo in ACTIVE/PAUSED a mano; impostiamo DRAFT solo alla creazione.
        targetServiceSlug: c.targetServiceSlug,
        requiresAnyOwnedSlug: c.requiresAnyOwnedSlug,
        excludesOwnedSlug: c.excludesOwnedSlug,
      },
      create: {
        key: c.key,
        name: c.name,
        description: c.description,
        priority: c.priority,
        channel: "EMAIL",
        status: "DRAFT",
        targetServiceSlug: c.targetServiceSlug,
        requiresAnyOwnedSlug: c.requiresAnyOwnedSlug,
        excludesOwnedSlug: c.excludesOwnedSlug,
      },
      select: { id: true },
    });

    for (const s of c.steps) {
      await prisma.crossSellCampaignStep.upsert({
        where: { campaignId_stepIndex: { campaignId: campaign.id, stepIndex: s.stepIndex } },
        update: { delayDays: s.delayDays, subject: s.subject, body: s.body },
        create: {
          campaignId: campaign.id,
          stepIndex: s.stepIndex,
          delayDays: s.delayDays,
          subject: s.subject,
          body: s.body,
        },
      });
    }

    results.push({ key: c.key, created: !existing, steps: c.steps.length });
  }

  return results;
}
