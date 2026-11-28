-- CreateTable
CREATE TABLE "SplitGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isMe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitExpense" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "paidById" TEXT NOT NULL,
    "transactionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitShare" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,

    CONSTRAINT "SplitShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitSettlement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "SplitSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SplitGroup_userId_idx" ON "SplitGroup"("userId");

-- CreateIndex
CREATE INDEX "SplitMember_groupId_idx" ON "SplitMember"("groupId");

-- CreateIndex
CREATE INDEX "SplitExpense_groupId_date_idx" ON "SplitExpense"("groupId", "date");

-- CreateIndex
CREATE INDEX "SplitShare_memberId_idx" ON "SplitShare"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "SplitShare_expenseId_memberId_key" ON "SplitShare"("expenseId", "memberId");

-- CreateIndex
CREATE INDEX "SplitSettlement_groupId_date_idx" ON "SplitSettlement"("groupId", "date");

-- AddForeignKey
ALTER TABLE "SplitGroup" ADD CONSTRAINT "SplitGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitMember" ADD CONSTRAINT "SplitMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SplitGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitExpense" ADD CONSTRAINT "SplitExpense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SplitGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitExpense" ADD CONSTRAINT "SplitExpense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "SplitMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitShare" ADD CONSTRAINT "SplitShare_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "SplitExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitShare" ADD CONSTRAINT "SplitShare_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "SplitMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitSettlement" ADD CONSTRAINT "SplitSettlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SplitGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitSettlement" ADD CONSTRAINT "SplitSettlement_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "SplitMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitSettlement" ADD CONSTRAINT "SplitSettlement_toId_fkey" FOREIGN KEY ("toId") REFERENCES "SplitMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
