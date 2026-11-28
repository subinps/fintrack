-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'VOIDED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "voidReason" TEXT;

-- CreateTable
CREATE TABLE "TransactionHistory" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actor" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionHistory_transactionId_createdAt_idx" ON "TransactionHistory"("transactionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TransactionHistory_userId_createdAt_idx" ON "TransactionHistory"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_type_idx" ON "Account"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_userId_status_date_id_idx" ON "Transaction"("userId", "status", "date" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Transaction_userId_deletedAt_idx" ON "Transaction"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "TransactionSplit_transactionId_idx" ON "TransactionSplit"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionSplit_accountId_idx" ON "TransactionSplit"("accountId");

-- AddForeignKey
ALTER TABLE "TransactionHistory" ADD CONSTRAINT "TransactionHistory_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionHistory" ADD CONSTRAINT "TransactionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Merge duplicate accounts (same user, case-insensitive name and type) so the
-- case-insensitive unique index below can be created on existing data.
DO $$
DECLARE dup RECORD;
BEGIN
  FOR dup IN
    SELECT a."userId", a.type, MIN(a.id) AS keep_id, array_agg(a.id) AS ids
    FROM "Account" a
    GROUP BY a."userId", lower(a.name), a.type
    HAVING COUNT(*) > 1
  LOOP
    UPDATE "TransactionSplit" SET "accountId" = dup.keep_id WHERE "accountId" = ANY(dup.ids);
    DELETE FROM "Account" WHERE id = ANY(dup.ids) AND id <> dup.keep_id;
  END LOOP;
END $$;

-- F0.17: account names are unique per user, case-insensitively, within a type.
CREATE UNIQUE INDEX "Account_userId_lower_name_type_key" ON "Account" ("userId", lower(name), type);

-- F0.12: every transaction's splits always sum to zero, enforced at COMMIT.
CREATE OR REPLACE FUNCTION "fintrack_transaction_splits_balanced"() RETURNS trigger AS $$
DECLARE
  tx_id INTEGER;
  total NUMERIC;
  split_count INTEGER;
BEGIN
  tx_id := COALESCE(NEW."transactionId", OLD."transactionId");
  IF tx_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(SUM("amount"), 0), COUNT(*) INTO total, split_count
  FROM "TransactionSplit" WHERE "transactionId" = tx_id;
  IF split_count > 0 AND total <> 0 THEN
    RAISE EXCEPTION 'Transaction % is unbalanced: splits sum to % paise', tx_id, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "transaction_splits_balanced"
  AFTER INSERT OR UPDATE OR DELETE ON "TransactionSplit"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "fintrack_transaction_splits_balanced"();
