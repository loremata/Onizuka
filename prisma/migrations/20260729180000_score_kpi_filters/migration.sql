-- Filtri di conteggio per le righe di punteggio dei premi.
-- Serviva perché la lettera TIM distingue casi che il modello non sapeva dire:
--   "Accessi Consumer (netto FWA Ricaricabile)" -> tutti gli accessi TRANNE gli FWA ric.
--   "MNP MVNO da Iliad/Coop/Poste" (3 pt) vs "MNP netto MVNO" (2 pt) -> filtro provenienza.
--   "MNP Valore (canone >= 9,99)" -> soglia sul canone.
-- Solo colonne aggiuntive, tutte opzionali: nessuna perdita di dati.
ALTER TABLE "IncentiveScoreKpi"
  ADD COLUMN IF NOT EXISTS "excludeSubtype"  TEXT,
  ADD COLUMN IF NOT EXISTS "provenanceIn"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "provenanceNotIn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "minFeeEur"       DECIMAL(12,2);
