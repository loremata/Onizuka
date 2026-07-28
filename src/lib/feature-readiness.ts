import { isLlmConfigured } from "@/lib/llm-client";
import { isWhatsAppConfigured } from "@/lib/whatsapp-cloud";
import { isMetaNativePublishConfigured } from "@/lib/social-publish-meta";
import { isLinkedInNativePublishConfigured } from "@/lib/social-publish-linkedin";
import { isGbpNativePublishConfigured } from "@/lib/social-publish-gbp";

/**
 * ONESTÀ DELL'INTERFACCIA.
 *
 * Una pagina che mostra pulsanti e schede come se tutto funzionasse, mentre a
 * monte manca la chiave dell'integrazione, non è un dettaglio estetico: è la
 * differenza tra un prodotto e una demo. Chi la usa fa affidamento su qualcosa
 * che non succederà, e lo scopre quando è tardi.
 *
 * Qui sta l'elenco delle funzioni che dipendono da una configurazione esterna,
 * con TRE informazioni per ciascuna: cosa serve, cosa funziona lo stesso, e
 * cosa invece non succede. Il banner si spegne da solo il giorno in cui la
 * configurazione arriva — nessuna stringa da andare a correggere a mano.
 */

export type FeatureKey =
  | "assistant-llm"
  | "social-publishing"
  | "social-metrics"
  | "analytics-ga4"
  | "analytics-ads"
  | "whatsapp";

export type FeatureReadiness = {
  key: FeatureKey;
  label: string;
  ready: boolean;
  /** Cosa manca, in termini comprensibili (non nomi di variabili e basta). */
  missing: string;
  /** Cosa continua a funzionare: evita di far credere che la pagina sia inutile. */
  worksAnyway: string;
  /** Cosa NON succede finché manca. È la parte che conta. */
  doesNotHappen: string;
};

function readiness(key: FeatureKey): FeatureReadiness {
  switch (key) {
    case "assistant-llm":
      return {
        key,
        label: "Assistente AI",
        ready: isLlmConfigured(),
        missing: "una chiave API del modello (OPENAI_API_KEY)",
        worksAnyway:
          "le risposte basate su regole e sui dati di Onizuka: scorciatoie, numeri, link alle pagine giuste",
        doesNotHappen: "le risposte scritte in linguaggio naturale e i riassunti generati",
      };
    case "social-publishing":
      return {
        key,
        label: "Pubblicazione social automatica",
        ready:
          isMetaNativePublishConfigured() ||
          isLinkedInNativePublishConfigured() ||
          isGbpNativePublishConfigured(),
        missing: "il collegamento a Meta, LinkedIn o Google Business Profile",
        worksAnyway:
          "calendario editoriale, approvazione dei post, segnare pubblicato a mano con URL e metriche",
        doesNotHappen: "la pubblicazione automatica all'orario programmato: i post restano in attesa",
      };
    case "social-metrics":
      return {
        key,
        label: "Metriche social automatiche",
        ready: isMetaNativePublishConfigured() || isLinkedInNativePublishConfigured(),
        missing: "il collegamento agli account social",
        worksAnyway: "le metriche inserite a mano sul singolo post",
        doesNotHappen: "l'aggiornamento automatico di impression, reach ed engagement",
      };
    case "analytics-ga4":
      return {
        key,
        label: "Google Analytics",
        ready: Boolean(process.env.GOOGLE_ANALYTICS_CLIENT_ID?.trim()),
        missing: "le credenziali OAuth di Google Analytics",
        worksAnyway: "tutto ciò che Onizuka misura da sé: audit, pipeline, compensi",
        doesNotHappen: "l'import automatico delle sessioni e delle conversioni dai siti dei clienti",
      };
    case "analytics-ads":
      return {
        key,
        label: "Campagne pubblicitarie",
        ready: Boolean(
          process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || process.env.META_ADS_ACCESS_TOKEN?.trim()
        ),
        missing: "il collegamento a Google Ads o Meta Ads",
        worksAnyway: "il registro delle spese pubblicitarie inserite a mano in Finance",
        doesNotHappen: "l'import automatico di spesa, click e conversioni delle campagne",
      };
    case "whatsapp":
      return {
        key,
        label: "WhatsApp Business",
        ready: isWhatsAppConfigured(),
        missing: "le credenziali WhatsApp Business Cloud API",
        worksAnyway: "i messaggi preparati da copiare e i link wa.me da aprire a mano",
        doesNotHappen: "l'invio e la ricezione automatica dei messaggi dentro Onizuka",
      };
  }
}

export function featureReadiness(key: FeatureKey): FeatureReadiness {
  return readiness(key);
}

/** Tutte, per il quadro d'insieme in Impostazioni. */
export function allFeatureReadiness(): FeatureReadiness[] {
  const keys: FeatureKey[] = [
    "assistant-llm",
    "social-publishing",
    "social-metrics",
    "analytics-ga4",
    "analytics-ads",
    "whatsapp",
  ];
  return keys.map(readiness);
}
