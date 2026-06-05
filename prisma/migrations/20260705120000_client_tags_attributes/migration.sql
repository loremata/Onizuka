-- Client: tag liberi per segmentazione
ALTER TABLE "Client" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Attributi chiave-valore cliente
CREATE TABLE "ClientAttribute" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientAttribute_clientId_key_key" ON "ClientAttribute"("clientId", "key");
CREATE INDEX "ClientAttribute_clientId_idx" ON "ClientAttribute"("clientId");
CREATE INDEX "ClientAttribute_key_idx" ON "ClientAttribute"("key");

ALTER TABLE "ClientAttribute" ADD CONSTRAINT "ClientAttribute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
