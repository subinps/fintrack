-- AlterTable
ALTER TABLE "User" ADD COLUMN "automationPaused" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex: a run history keeps every run, not only the first of the day
DROP INDEX IF EXISTS "AutomationRun_automationId_runDate_isDryRun_key";

-- CreateIndex
CREATE INDEX "AutomationRun_automationId_runDate_idx" ON "AutomationRun"("automationId", "runDate");
