-- Fase 1 customer-scoring-v2: arricchimento contratti retail + reminder cambio compagnia.
-- Additiva e non distruttiva (solo ADD VALUE / ADD COLUMN / CREATE INDEX).

-- AlterEnum: nuovi tipi retail per capillarità (fibra, gas, telepass).
ALTER TYPE "RetailContractKind" ADD VALUE 'FIBER';
ALTER TYPE "RetailContractKind" ADD VALUE 'GAS';
ALTER TYPE "RetailContractKind" ADD VALUE 'TELEPASS';

-- AlterTable: dettagli contratto + dati per il reminder cambio compagnia.
ALTER TABLE "ClientRetailContract"
  ADD COLUMN "operator" TEXT,
  ADD COLUMN "offerName" TEXT,
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "switchAfterMonths" INTEGER,
  ADD COLUMN "switchReminderAt" TIMESTAMP(3);

-- CreateIndex: per interrogare i cambi compagnia in scadenza.
CREATE INDEX "ClientRetailContract_switchReminderAt_idx" ON "ClientRetailContract"("switchReminderAt");
