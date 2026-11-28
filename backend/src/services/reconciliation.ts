import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { formatPaise, rupeesToPaise } from '../lib/money';
import { LedgerError } from './ledger';

/** Phase 5: bank reconciliation. Cleared lines are marked per split. */

const assertOwned = async (userId: string, accountId: number) => {
    const account = await prisma.account.findFirst({
        where: { id: accountId, userId },
        select: { id: true, name: true, type: true, symbol: true, units: true },
    });
    if (!account) throw new LedgerError(404, 'ACCOUNT_NOT_FOUND', 'Account not found.');
    return account;
};

export interface ReconLine {
    splitId: number;
    transactionId: number;
    date: string;
    description: string;
    amount: string;
    status: string;
    source: string;
    tags: string[];
    reconciledAt: string | null;
    statementRunId: string | null;
}

export async function listLines(
    userId: string,
    accountId: number,
    options: { from?: string; to?: string; status?: 'all' | 'cleared' | 'uncleared'; limit?: number }
): Promise<ReconLine[]> {
    await assertOwned(userId, accountId);
    const status = options.status ?? 'all';
    const where: Prisma.TransactionSplitWhereInput = {
        accountId,
        transaction: {
            userId,
            status: { not: 'VOIDED' },
            ...(options.from || options.to
                ? {
                      date: {
                          ...(options.from ? { gte: new Date(`${options.from}T00:00:00Z`) } : {}),
                          ...(options.to ? { lte: new Date(`${options.to}T23:59:59Z`) } : {}),
                      },
                  }
                : {}),
        },
        ...(status === 'cleared' ? { reconciledAt: { not: null } } : {}),
        ...(status === 'uncleared' ? { reconciledAt: null } : {}),
    };

    const splits = await prisma.transactionSplit.findMany({
        where,
        include: { transaction: { select: { id: true, date: true, description: true, status: true, source: true, tags: true } } },
        orderBy: [{ transaction: { date: 'desc' } }, { id: 'desc' }],
        take: options.limit ?? 400,
    });

    return splits.map((split) => ({
        splitId: split.id,
        transactionId: split.transaction.id,
        date: split.transaction.date.toISOString().slice(0, 10),
        description: split.transaction.description,
        amount: formatPaise(split.amount),
        status: split.transaction.status,
        source: split.transaction.source,
        tags: split.transaction.tags,
        reconciledAt: split.reconciledAt ? split.reconciledAt.toISOString() : null,
        statementRunId: split.statementRunId,
    }));
}

export interface ReconSummary {
    accountId: number;
    accountName: string;
    ledgerBalance: string;
    clearedBalance: string;
    unclearedBalance: string;
    unclearedCount: number;
    clearedCount: number;
    lastReconciledAt: string | null;
}

export async function summarise(userId: string, accountId: number): Promise<ReconSummary> {
    const account = await assertOwned(userId, accountId);
    const splits = await prisma.transactionSplit.findMany({
        where: { accountId, transaction: { userId, status: { not: 'VOIDED' } } },
        select: { amount: true, reconciledAt: true },
    });
    let ledger = 0n;
    let cleared = 0n;
    let clearedCount = 0;
    let last: Date | null = null;
    for (const split of splits) {
        ledger += split.amount;
        if (split.reconciledAt) {
            cleared += split.amount;
            clearedCount += 1;
            if (!last || split.reconciledAt > last) last = split.reconciledAt;
        }
    }
    return {
        accountId,
        accountName: account.name,
        ledgerBalance: formatPaise(ledger),
        clearedBalance: formatPaise(cleared),
        unclearedBalance: formatPaise(ledger - cleared),
        unclearedCount: splits.length - clearedCount,
        clearedCount,
        lastReconciledAt: last ? last.toISOString() : null,
    };
}

export interface CompleteResult {
    reconciled: number;
    runId: string;
    summary: ReconSummary;
    difference: string | null;
    balanced: boolean | null;
}

export async function completeReconciliation(
    userId: string,
    accountId: number,
    splitIds: number[],
    statementBalance?: string
): Promise<CompleteResult> {
    await assertOwned(userId, accountId);
    if (!Array.isArray(splitIds) || splitIds.length === 0) {
        throw new LedgerError(400, 'NO_LINES', 'Select at least one line to reconcile.');
    }
    const runId = randomUUID();
    const updated = await prisma.transactionSplit.updateMany({
        where: { id: { in: splitIds }, accountId, transaction: { userId } },
        data: { reconciledAt: new Date(), statementRunId: runId },
    });
    const summary = await summarise(userId, accountId);
    let difference: string | null = null;
    let balanced: boolean | null = null;
    if (statementBalance !== undefined && statementBalance !== null && statementBalance !== '') {
        const statementPaise = rupeesToPaise(statementBalance);
        const clearedPaise = rupeesToPaise(summary.clearedBalance);
        difference = formatPaise(clearedPaise - statementPaise);
        balanced = clearedPaise === statementPaise;
    }
    return { reconciled: updated.count, runId, summary, difference, balanced };
}

export async function undoReconciliation(userId: string, accountId: number, splitIds: number[]): Promise<CompleteResult> {
    await assertOwned(userId, accountId);
    const updated = await prisma.transactionSplit.updateMany({
        where: { id: { in: splitIds }, accountId, transaction: { userId } },
        data: { reconciledAt: null, statementRunId: null },
    });
    return {
        reconciled: updated.count,
        runId: '',
        summary: await summarise(userId, accountId),
        difference: null,
        balanced: null,
    };
}

/** "Create adjustment" posts the rupee difference so cleared balance equals the statement. */
export async function adjustmentSuggestion(userId: string, accountId: number, statementBalance: string) {
    const summary = await summarise(userId, accountId);
    const difference = rupeesToPaise(summary.clearedBalance) - rupeesToPaise(statementBalance);
    return { difference: formatPaise(difference), accountId, needed: difference !== 0n };
}
