-- Aggiunge ownerUserId a MemoryItem (tabella creata dal vecchio MVP senza proprietario).

ALTER TABLE "MemoryItem" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

UPDATE "MemoryItem" m
SET "ownerUserId" = u.id
FROM (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" LIMIT 1) u
WHERE m."ownerUserId" IS NULL;

ALTER TABLE "MemoryItem" ALTER COLUMN "ownerUserId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "MemoryItem_ownerUserId_idx" ON "MemoryItem"("ownerUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MemoryItem_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "MemoryItem"
      ADD CONSTRAINT "MemoryItem_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
