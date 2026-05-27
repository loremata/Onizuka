ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

UPDATE "Opportunity" o
SET "ownerUserId" = u.id
FROM (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" LIMIT 1) u
WHERE o."ownerUserId" IS NULL;

ALTER TABLE "Opportunity" ALTER COLUMN "ownerUserId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Opportunity_ownerUserId_idx" ON "Opportunity"("ownerUserId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_ownerUserId_fkey') THEN
    ALTER TABLE "Opportunity"
      ADD CONSTRAINT "Opportunity_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
