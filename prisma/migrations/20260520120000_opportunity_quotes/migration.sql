CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

CREATE TABLE "OpportunityQuote" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT'::"QuoteStatus",
    "linesJson" TEXT NOT NULL,
    "taxPercent" INTEGER NOT NULL DEFAULT 22,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpportunityQuote_opportunityId_idx" ON "OpportunityQuote"("opportunityId");
CREATE INDEX "OpportunityQuote_ownerUserId_idx" ON "OpportunityQuote"("ownerUserId");

ALTER TABLE "OpportunityQuote" ADD CONSTRAINT "OpportunityQuote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityQuote" ADD CONSTRAINT "OpportunityQuote_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
