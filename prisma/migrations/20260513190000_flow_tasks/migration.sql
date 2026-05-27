-- Onizuka Flow (MVP 1): task operativi collegabili a clienti

CREATE TYPE "FlowTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'WAITING', 'DONE', 'CANCELLED');

CREATE TYPE "FlowTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "FlowTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FlowTaskStatus" NOT NULL DEFAULT 'TODO'::"FlowTaskStatus",
    "priority" "FlowTaskPriority" NOT NULL DEFAULT 'MEDIUM'::"FlowTaskPriority",
    "dueDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "relatedClientId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FlowTask_ownerUserId_idx" ON "FlowTask"("ownerUserId");

CREATE INDEX "FlowTask_status_idx" ON "FlowTask"("status");

ALTER TABLE "FlowTask" ADD CONSTRAINT "FlowTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FlowTask" ADD CONSTRAINT "FlowTask_relatedClientId_fkey" FOREIGN KEY ("relatedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
