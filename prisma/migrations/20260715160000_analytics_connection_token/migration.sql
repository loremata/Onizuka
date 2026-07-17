-- Blocco 4: token cifrato per-connessione (usato dalle fonti ads self-contained).
ALTER TABLE "AnalyticsConnection" ADD COLUMN "tokenCipher" TEXT;
