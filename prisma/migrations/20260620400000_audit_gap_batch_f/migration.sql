-- CreateTable
CREATE TABLE "ClientOnboardingItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOnboardingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCommitment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "ownerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantChatThread" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nuova chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientOnboardingItem_clientId_idx" ON "ClientOnboardingItem"("clientId");
CREATE INDEX "ClientOnboardingItem_ownerUserId_status_idx" ON "ClientOnboardingItem"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "ClientCommitment_clientId_idx" ON "ClientCommitment"("clientId");
CREATE INDEX "ClientCommitment_ownerUserId_status_idx" ON "ClientCommitment"("ownerUserId", "status");
CREATE INDEX "ClientCommitment_dueDate_idx" ON "ClientCommitment"("dueDate");

-- CreateIndex
CREATE INDEX "AssistantChatThread_ownerUserId_updatedAt_idx" ON "AssistantChatThread"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantChatMessage_threadId_createdAt_idx" ON "AssistantChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiRun_ownerUserId_createdAt_idx" ON "AiRun"("ownerUserId", "createdAt");
CREATE INDEX "AiRun_kind_idx" ON "AiRun"("kind");

-- AddForeignKey
ALTER TABLE "ClientOnboardingItem" ADD CONSTRAINT "ClientOnboardingItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientOnboardingItem" ADD CONSTRAINT "ClientOnboardingItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommitment" ADD CONSTRAINT "ClientCommitment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientCommitment" ADD CONSTRAINT "ClientCommitment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantChatThread" ADD CONSTRAINT "AssistantChatThread_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantChatMessage" ADD CONSTRAINT "AssistantChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
