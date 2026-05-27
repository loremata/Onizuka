export type SalesPlaybook = {
  id: string;
  title: string;
  when: string;
  opener: string;
  bullets: string[];
};

export const SALES_PLAYBOOKS: SalesPlaybook[] = [
  {
    id: "reactivate-dormant",
    title: "Riattivazione cliente dormiente",
    when: "Stato DORMANT o nessun contatto da 90+ giorni",
    opener: "Ciao [Nome], volevo fare un punto veloce su come sta andando [asset/progetto] e se possiamo supportarvi su qualcosa di concreto.",
    bullets: [
      "Richiama un risultato passato (post, campagna, metrica)",
      "Proponi audit leggero gratuito o call 20 min",
      "Chiudi con una data per il prossimo passo",
    ],
  },
  {
    id: "quote-follow-up",
    title: "Follow-up preventivo inviato",
    when: "Stato QUOTE_SENT o opportunità OPEN con valore stimato",
    opener: "Ti scrivo per capire se il preventivo è chiaro e se ci sono domande prima di procedere.",
    bullets: [
      "Chiedi feedback su priorità e budget",
      "Offri micro-aggiustamento (non sconto automatico)",
      "Proponi call entro 48h se silenzio",
    ],
  },
  {
    id: "win-opportunity",
    title: "Chiusura opportunità calda",
    when: "Opportunità OPEN alta priorità in pipeline",
    opener: "Per allinearci sulla partenza: cosa ti serve ancora per dare l’ok formale?",
    bullets: [
      "Riassumi scope e deliverable",
      "Conferma timeline e referente operativo",
      "Definisci kick-off e primo task Flow",
    ],
  },
];
