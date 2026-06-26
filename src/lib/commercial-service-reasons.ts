/**
 * Motivi "non attivo con noi" per un servizio (telefonia/energia/digitale…).
 * Diventano tag filtrabili per le campagne: così non riproponi a chi ha già
 * detto no per un motivo valido (es. vincolo con altro operatore).
 */
export const COMMERCIAL_SERVICE_REASONS: { code: string; label: string }[] = [
  { code: "non_proposto", label: "Non ancora proposto" },
  { code: "gia_consulente", label: "Ha già consulente/agenzia" },
  { code: "vincolo_operatore", label: "Vincolo con altro operatore" },
  { code: "non_interessato", label: "Non interessato" },
  { code: "prezzo", label: "Questione di prezzo" },
  { code: "in_valutazione", label: "Ci sta valutando" },
  { code: "altro", label: "Altro" },
];

export const COMMERCIAL_SERVICE_REASON_LABELS: Record<string, string> = Object.fromEntries(
  COMMERCIAL_SERVICE_REASONS.map((r) => [r.code, r.label]),
);

export const COMMERCIAL_SERVICE_REASON_CODES = COMMERCIAL_SERVICE_REASONS.map((r) => r.code);
