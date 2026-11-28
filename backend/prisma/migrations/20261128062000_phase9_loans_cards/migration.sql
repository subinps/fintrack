-- Phase 9: loan and card details on accounts

ALTER TABLE "Account" ADD COLUMN "loanPrincipalPaise" BIGINT;
ALTER TABLE "Account" ADD COLUMN "tenureMonths" INTEGER;
ALTER TABLE "Account" ADD COLUMN "emiPaise" BIGINT;
ALTER TABLE "Account" ADD COLUMN "creditLimitPaise" BIGINT;
ALTER TABLE "Account" ADD COLUMN "statementDay" INTEGER;
ALTER TABLE "Account" ADD COLUMN "dueDay" INTEGER;
