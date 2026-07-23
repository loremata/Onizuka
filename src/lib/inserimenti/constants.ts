/** Chiavi note di StoreMonthlyInput (input mensili non derivabili dalle vendite). */

/** Obiettivo personale di compensi del mese: è una cosa che ti dai tu,
 *  distinta dai target di gara che ti dà TIM. */
export const GOAL_KEY = "goal.compensi";

/** Volume Up-Selling del Customer Base: sotto 8 il premio è dimezzato. */
export const UPSELLING_KEY = "cb.upsellingVolume";

/** Ordine fisso dei brand del negozio (decisione Lorenzo 22/07): vale per
 *  tabella recap, chip filtro e schede brand. KENA in coda finché non ha
 *  un'incentivazione propria. */
export const BRAND_ORDER = ["TIM", "FASTWEB", "ENEL", "ILIAD", "ENI", "KENA"] as const;

/** I brand mostrati come schede nel cruscotto (KENA escluso: nessun piano). */
export const BRAND_TILES = BRAND_ORDER.filter((b) => b !== "KENA");
