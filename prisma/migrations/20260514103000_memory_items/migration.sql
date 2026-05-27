-- Onizuka Memory (MVP 1): voci di memoria persistente manuale

CREATE TYPE "MemoryScope" AS ENUM (
  'PERSONAL',
  'BUSINESS',
  'ASSET',
  'CLIENT',
  'EPISODIC',
  'DOCUMENTAL',
  'SENSITIVE'
);

CREATE TYPE "MemorySensitivity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE "MemorySource" AS ENUM ('MANUAL', 'VOICE', 'CHAT', 'DOCUMENT', 'SYSTEM');

CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "scope" "MemoryScope" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "relatedClientId" TEXT,
    "relatedAssetId" TEXT,
    "sensitivity" "MemorySensitivity" NOT NULL DEFAULT 'LOW'::"MemorySensitivity",
    "source" "MemorySource" NOT NULL DEFAULT 'MANUAL'::"MemorySource",
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemoryItem_ownerUserId_idx" ON "MemoryItem"("ownerUserId");

CREATE INDEX "MemoryItem_scope_idx" ON "MemoryItem"("scope");

CREATE INDEX "MemoryItem_relatedClientId_idx" ON "MemoryItem"("relatedClientId");

ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_relatedClientId_fkey" FOREIGN KEY ("relatedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
