-- Fase 1b customer-scoring-v2: motivo "non attivo con noi" per servizio (targeting promo).
-- Additiva e non distruttiva.
ALTER TABLE "ClientCommercialService" ADD COLUMN "inactiveReason" TEXT;
