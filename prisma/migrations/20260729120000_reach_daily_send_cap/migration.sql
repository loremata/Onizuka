-- Tetto giornaliero agli invii automatici (follow-up) e data dell'ultimo
-- aumento. Serve al consigliere: una soglia nuova deve reggere qualche giorno
-- prima di proporne un'altra.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reachDailySendCap" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reachCapRaisedAt" TIMESTAMP(3);
