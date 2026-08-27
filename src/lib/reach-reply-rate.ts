import { isNonSito } from "@/lib/audit-evidence";

/**
 * TASSO DI RISPOSTA — l'unica misura lecita sul contatto a freddo.
 *
 * Aperture e clic restano a zero per scelta (niente pixel né riscrittura link
 * senza consenso alla profilazione), quindi un A/B sulle aperture non direbbe
 * nulla. Conta chi RISPONDE.
 *
 * L'unità di misura è la PERSONA raggiunta, non la bozza: la sequenza è di tre
 * mail e chi risponde al follow-up ha risposto al contatto. Variante e segmento
 * vengono dalla PRIMA mail, quella che ha aperto la porta.
 */

export type EsitoInvio = {
  id: string;
  abVariantSent: string | null;
  repliedAt: Date | null;
  sentToEmail: string | null;
  client: { website: string | null; city: string | null } | null;
  lead: { website: string | null; city: string | null; source: string | null } | null;
};

export type EsitoContatto = {
  variante: string;
  segmento: string;
  comune: string;
  risposta: boolean;
};

export type TassoGruppo = {
  chiave: string;
  contattati: number;
  risposte: number;
  tasso: number;
};

/** Sotto questa soglia il tasso è rumore: si mostra, ma detto. */
export const CAMPIONE_MINIMO = 30;

/** Segmento del messaggio: A = senza un sito vero, B = con sito (restyling). */
export function segmentoDi(r: EsitoInvio): string {
  const sito = (r.lead?.website || r.client?.website || "").trim();
  return !sito || isNonSito(sito) ? "A · senza sito" : "B · con sito";
}

/** Provenienza: prima il comune dello scraping, poi la città in anagrafica. */
export function comuneDi(r: EsitoInvio): string {
  const m = (r.lead?.source ?? "").match(/^scraping(?:-google)?:(.+)$/);
  if (m) return m[1].trim();
  const citta = (r.lead?.city || r.client?.city || "").trim();
  if (!citta) return "—";
  return citta.charAt(0).toUpperCase() + citta.slice(1).toLowerCase();
}

/**
 * Riduce gli invii a contatti raggiunti. `invii` arriva dal più recente al più
 * vecchio (come la query li ordina): si scorre al contrario, così il primo
 * invio a ogni recapito è quello che detta variante e segmento.
 */
export function contattiDagliInvii(invii: EsitoInvio[]): EsitoContatto[] {
  const perRecapito = new Map<string, EsitoContatto>();
  for (let i = invii.length - 1; i >= 0; i--) {
    const r = invii[i];
    const chiave = r.sentToEmail?.trim().toLowerCase() || `bozza:${r.id}`;
    const esistente = perRecapito.get(chiave);
    if (!esistente) {
      perRecapito.set(chiave, {
        variante: r.abVariantSent ? `Variante ${r.abVariantSent}` : "Variante non registrata",
        segmento: segmentoDi(r),
        comune: comuneDi(r),
        risposta: Boolean(r.repliedAt),
      });
    } else if (r.repliedAt) {
      esistente.risposta = true;
    }
  }
  return Array.from(perRecapito.values());
}

/** Tasso di risposta per chiave, dal gruppo più contattato al meno. */
export function tassiPerChiave(
  contatti: EsitoContatto[],
  chiave: (c: EsitoContatto) => string
): TassoGruppo[] {
  const m = new Map<string, { contattati: number; risposte: number }>();
  for (const c of contatti) {
    const k = chiave(c);
    const cur = m.get(k) ?? { contattati: 0, risposte: 0 };
    cur.contattati += 1;
    if (c.risposta) cur.risposte += 1;
    m.set(k, cur);
  }
  return Array.from(m.entries())
    .map(([k, v]) => ({
      chiave: k,
      contattati: v.contattati,
      risposte: v.risposte,
      tasso: v.contattati ? (v.risposte / v.contattati) * 100 : 0,
    }))
    .sort((a, b) => b.contattati - a.contattati);
}
