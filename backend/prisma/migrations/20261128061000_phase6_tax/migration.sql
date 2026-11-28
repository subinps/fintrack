CREATE TABLE "TaxProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 4,
    "regime" TEXT NOT NULL DEFAULT 'new',
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxProfile_userId_key" ON "TaxProfile"("userId");

ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
