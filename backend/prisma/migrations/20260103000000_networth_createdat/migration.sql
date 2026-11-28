-- Net worth snapshots record when they were written.
ALTER TABLE "NetWorthSnapshot" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
