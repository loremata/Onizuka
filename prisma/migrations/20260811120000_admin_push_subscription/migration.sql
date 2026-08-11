-- Iscrizioni Web Push degli utenti admin: una riga per dispositivo/browser.
-- Additiva: nessuna colonna o tabella esistente viene toccata, quindi non
-- serve la procedura espandi/contrai in due deploy.
CREATE TABLE IF NOT EXISTS "AdminPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPushSubscription_pkey" PRIMARY KEY ("id")
);

-- L'endpoint identifica l'iscrizione lato push service: e' la chiave naturale
-- per l'upsert quando lo stesso browser si riscrive.
CREATE UNIQUE INDEX IF NOT EXISTS "AdminPushSubscription_endpoint_key"
    ON "AdminPushSubscription"("endpoint");

CREATE INDEX IF NOT EXISTS "AdminPushSubscription_userId_idx"
    ON "AdminPushSubscription"("userId");

DO $$
BEGIN
    ALTER TABLE "AdminPushSubscription"
        ADD CONSTRAINT "AdminPushSubscription_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
