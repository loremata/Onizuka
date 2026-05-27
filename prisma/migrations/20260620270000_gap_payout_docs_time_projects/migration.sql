ALTER TABLE "ReferrerPayout" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "ReferrerPayout" ADD COLUMN "documentUrl" TEXT;

ALTER TABLE "User" ADD COLUMN "timeApproverProjectCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
