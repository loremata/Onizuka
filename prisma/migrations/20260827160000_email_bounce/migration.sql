-- Rimbalzi di posta (bounce): il MAILER-DAEMON dice quali indirizzi non esistono.
-- Senza questa tabella l'outreach continuava a scrivere a caselle morte, e ogni
-- tentativo pesa sulla reputazione del dominio (quindi sulla consegna delle altre).
-- Idempotente: riapplicabile senza danni.
CREATE TABLE IF NOT EXISTS "EmailBounce" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "code" TEXT,
    "reason" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailBounce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailBounce_email_key" ON "EmailBounce"("email");
CREATE INDEX IF NOT EXISTS "EmailBounce_permanent_lastAt_idx" ON "EmailBounce"("permanent", "lastAt");
