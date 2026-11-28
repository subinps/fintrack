-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "rrule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "maxRuns" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'AUTO_POST',
    "catchUp" TEXT NOT NULL DEFAULT 'ALL',
    "weekendPolicy" TEXT NOT NULL DEFAULT 'SAME',
    "amountMode" TEXT NOT NULL DEFAULT 'FIXED',
    "formula" TEXT,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remindDaysBefore" INTEGER NOT NULL DEFAULT 0,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOccurrence" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" INTEGER,
    "amountPaise" BIGINT,
    "note" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringRule_userId_isActive_nextRunAt_idx" ON "RecurringRule"("userId", "isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringRule_nextRunAt_idx" ON "RecurringRule"("nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringOccurrence_ruleId_dueDate_idx" ON "RecurringOccurrence"("ruleId", "dueDate");

-- CreateIndex
CREATE INDEX "RecurringOccurrence_status_dueDate_idx" ON "RecurringOccurrence"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOccurrence_ruleId_dueDate_key" ON "RecurringOccurrence"("ruleId", "dueDate");

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RecurringRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
