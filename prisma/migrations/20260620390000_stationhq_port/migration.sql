-- CreateTable
CREATE TABLE "LeadFollowup" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "outcome" TEXT DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegiaDailySheet" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegiaDailySheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceRecommendation" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "href" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadFollowup_leadId_idx" ON "LeadFollowup"("leadId");

-- CreateIndex
CREATE INDEX "LeadFollowup_scheduledAt_idx" ON "LeadFollowup"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegiaDailySheet_ownerUserId_day_key" ON "RegiaDailySheet"("ownerUserId", "day");

-- CreateIndex
CREATE INDEX "RegiaDailySheet_ownerUserId_day_idx" ON "RegiaDailySheet"("ownerUserId", "day");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_ownerUserId_dismissedAt_idx" ON "IntelligenceRecommendation"("ownerUserId", "dismissedAt");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_createdAt_idx" ON "IntelligenceRecommendation"("createdAt");

-- AddForeignKey
ALTER TABLE "LeadFollowup" ADD CONSTRAINT "LeadFollowup_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegiaDailySheet" ADD CONSTRAINT "RegiaDailySheet_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRecommendation" ADD CONSTRAINT "IntelligenceRecommendation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
