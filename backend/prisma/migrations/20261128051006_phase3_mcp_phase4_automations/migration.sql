-- CreateTable
CREATE TABLE "PersonalAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read']::TEXT[],
    "writeMode" TEXT NOT NULL DEFAULT 'DRAFT',
    "accountAllowList" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpAuditLog" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "summary" TEXT,
    "error" TEXT,
    "ip" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "script" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "encryptedSecrets" TEXT,
    "secretsIv" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "webhookSecretHash" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationVersion" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "script" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "transactionIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAccessToken_tokenHash_key" ON "PersonalAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PersonalAccessToken_userId_revokedAt_idx" ON "PersonalAccessToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "McpAuditLog_userId_createdAt_idx" ON "McpAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "McpAuditLog_tokenId_createdAt_idx" ON "McpAuditLog"("tokenId", "createdAt");

-- CreateIndex
CREATE INDEX "Automation_userId_archivedAt_idx" ON "Automation"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationVersion_automationId_version_key" ON "AutomationVersion"("automationId", "version");

-- CreateIndex
CREATE INDEX "AutomationRun_automationId_createdAt_idx" ON "AutomationRun"("automationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_automationId_runDate_isDryRun_key" ON "AutomationRun"("automationId", "runDate", "isDryRun");

-- AddForeignKey
ALTER TABLE "PersonalAccessToken" ADD CONSTRAINT "PersonalAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpAuditLog" ADD CONSTRAINT "McpAuditLog_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "PersonalAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationVersion" ADD CONSTRAINT "AutomationVersion_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
