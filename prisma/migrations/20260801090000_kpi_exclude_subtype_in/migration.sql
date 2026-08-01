-- Esclusione di PIÙ subtype su una riga di punteggio.
-- Serve alla riga "Accessi Consumer" del Top Club: la lettera esclude gli FWA
-- ricaricabile, e le linee PMI e le trasformazioni fibra hanno righe di
-- punteggio proprie, quindi non vanno contate anche lì.
-- Colonna aggiuntiva con default: nessuna perdita di dati (espandi/contrai).
ALTER TABLE "IncentiveScoreKpi"
  ADD COLUMN IF NOT EXISTS "excludeSubtypeIn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
