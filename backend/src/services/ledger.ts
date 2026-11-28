import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { emitLedgerEvent } from '../lib/events';

export class LedgerError extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = 'LedgerError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

export type LedgerLine = {
    accountId: number;
    amount: bigint;
    units?: string | number | Prisma.Decimal | null;
};

export type TransactionStatusValue = 'DRAFT' | 'COMPLETED' | 'VOIDED';

export interface PostTransactionInput {
    userId: string;
    description: string;
    date?: Date | string | null;
    lines: LedgerLine[];
    status?: TransactionStatusValue;
    source?: string;
    sourceId?: string | null;
    idempotencyKey?: string | null;
    actor?: string;
    client?: Prisma.TransactionClient;
}

export interface UpdateTransactionInput {
    userId: string;
    id: number;
    description?: string;
    date?: Date | string;
    lines?: LedgerLine[];
    status?: TransactionStatusValue;
    actor?: string;
    client?: Prisma.TransactionClient;
}

type Db = Prisma.TransactionClient;

const sumLines = (lines: LedgerLine[]): bigint => lines.reduce((total, line) => total + line.amount, BigInt(0));

export function assertBalanced(lines: LedgerLine[]): void {
    if (lines.length === 0) {
        throw new LedgerError(400, 'EMPTY_TRANSACTION', 'A transaction needs at least one split');
    }
    if (sumLines(lines) !== BigInt(0)) {
        throw new LedgerError(400, 'UNBALANCED_TRANSACTION', 'Transaction splits must sum to zero');
    }
}

export async function assertOwnedAccounts(userId: string, accountIds: number[], client: Db | typeof prisma = prisma): Promise<void> {
    const unique = [...new Set(accountIds)];
    const owned = await client.account.count({ where: { id: { in: unique }, userId } });
    if (owned !== unique.length) {
        throw new LedgerError(403, 'ACCOUNT_FORBIDDEN', 'Access denied. You do not own one or more accounts involved in this transaction.');
    }
}

const toDate = (value?: Date | string | null): Date | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return value instanceof Date ? value : new Date(value);
};

const toUnits = (value: LedgerLine['units']) => (value === undefined || value === null || value === '' ? null : value);

const lineData = (transactionId: number, line: LedgerLine) => ({
    transactionId,
    accountId: line.accountId,
    amount: line.amount,
    units: toUnits(line.units),
});

type SnapshotSource = {
    description: string;
    date: Date;
    status: string;
    source: string;
    sourceId: string | null;
    splits: { accountId: number; amount: bigint; units: unknown }[];
};

export const snapshotOf = (transaction: SnapshotSource): Prisma.InputJsonValue => ({
    description: transaction.description,
    date: transaction.date.toISOString(),
    status: transaction.status,
    source: transaction.source,
    sourceId: transaction.sourceId,
    splits: transaction.splits.map((split) => ({
        accountId: split.accountId,
        amount: split.amount.toString(),
        units: split.units === null || split.units === undefined ? null : String(split.units),
    })),
});

async function recordHistory(
    client: Db,
    entry: {
        transactionId: number;
        userId: string;
        action: 'CREATE' | 'UPDATE' | 'VOID' | 'RESTORE';
        before?: Prisma.InputJsonValue | null;
        after?: Prisma.InputJsonValue | null;
        actor?: string;
    }
): Promise<void> {
    await client.transactionHistory.create({
        data: {
            transactionId: entry.transactionId,
            userId: entry.userId,
            action: entry.action,
            before: entry.before ?? Prisma.JsonNull,
            after: entry.after ?? Prisma.JsonNull,
            actor: entry.actor ?? 'USER',
        },
    });
}

const withSplits = { splits: true } satisfies Prisma.TransactionInclude;

const isUniqueViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export async function postTransaction(input: PostTransactionInput) {
    assertBalanced(input.lines);
    await assertOwnedAccounts(input.userId, input.lines.map((line) => line.accountId), input.client ?? prisma);

    const run = async (client: Db) => {
        const created = await client.transaction.create({
            data: {
                userId: input.userId,
                description: input.description,
                date: toDate(input.date) ?? new Date(),
                status: input.status ?? 'COMPLETED',
                source: input.source ?? 'MANUAL',
                sourceId: input.sourceId ?? null,
                idempotencyKey: input.idempotencyKey ?? null,
                splits: {
                    create: input.lines.map((line) => ({
                        accountId: line.accountId,
                        amount: line.amount,
                        units: toUnits(line.units),
                    })),
                },
            },
            include: withSplits,
        });
        await recordHistory(client, {
            transactionId: created.id,
            userId: input.userId,
            action: 'CREATE',
            after: snapshotOf(created),
            actor: input.actor,
        });
        return created;
    };

    if (input.client) {
        return run(input.client);
    }

    let created;
    try {
        created = await prisma.$transaction(run);
    } catch (error) {
        if (isUniqueViolation(error) && input.idempotencyKey) {
            const existing = await prisma.transaction.findUnique({
                where: { idempotencyKey: input.idempotencyKey },
                include: withSplits,
            });
            if (existing) return existing;
        }
        throw error;
    }

    emitLedgerEvent({
        type: created.status === 'VOIDED' ? 'transaction.voided' : 'transaction.created',
        userId: input.userId,
        transactionId: created.id,
    });
    if (created.status === 'COMPLETED') {
        emitLedgerEvent({ type: 'transaction.completed', userId: input.userId, transactionId: created.id });
    }
    return created;
}

export async function updateTransaction(input: UpdateTransactionInput) {
    if (input.lines) assertBalanced(input.lines);
    if (input.lines) {
        await assertOwnedAccounts(input.userId, input.lines.map((line) => line.accountId), input.client ?? prisma);
    }

    const run = async (client: Db) => {
        const existing = await client.transaction.findFirst({
            where: { id: input.id, userId: input.userId },
            include: withSplits,
        });
        if (!existing) {
            throw new LedgerError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
        }
        if (existing.status === 'VOIDED') {
            throw new LedgerError(409, 'TRANSACTION_VOIDED', 'A voided transaction cannot be edited. Restore it first.');
        }

        const date = toDate(input.date);
        await client.transaction.update({
            where: { id: existing.id },
            data: {
                description: input.description ?? undefined,
                date: date ?? undefined,
                status: input.status ?? undefined,
            },
        });

        if (input.lines) {
            await client.transactionSplit.deleteMany({ where: { transactionId: existing.id } });
            await client.transactionSplit.createMany({
                data: input.lines.map((line) => lineData(existing.id, line)),
            });
        }

        const updated = await client.transaction.findUniqueOrThrow({
            where: { id: existing.id },
            include: withSplits,
        });

        await recordHistory(client, {
            transactionId: updated.id,
            userId: input.userId,
            action: 'UPDATE',
            before: snapshotOf(existing),
            after: snapshotOf(updated),
            actor: input.actor,
        });

        return updated;
    };

    if (input.client) {
        return run(input.client);
    }

    const updated = await prisma.$transaction(run);
    emitLedgerEvent({ type: 'transaction.updated', userId: input.userId, transactionId: updated.id });
    return updated;
}

export async function approveTransaction(id: number, userId: string, actor = 'USER') {
    const result = await prisma.$transaction(async (client) => {
        const existing = await client.transaction.findFirst({
            where: { id, userId },
            include: withSplits,
        });
        if (!existing) {
            throw new LedgerError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
        }
        if (existing.status === 'VOIDED') {
            throw new LedgerError(409, 'TRANSACTION_VOIDED', 'A voided transaction cannot be approved. Restore it first.');
        }
        if (existing.status === 'COMPLETED') {
            return { transaction: existing, changed: false };
        }

        const approved = await client.transaction.update({
            where: { id: existing.id },
            data: { status: 'COMPLETED' },
            include: withSplits,
        });
        await recordHistory(client, {
            transactionId: approved.id,
            userId,
            action: 'UPDATE',
            before: snapshotOf(existing),
            after: snapshotOf(approved),
            actor,
        });
        return { transaction: approved, changed: true };
    });

    if (result.changed) {
        emitLedgerEvent({ type: 'transaction.completed', userId, transactionId: result.transaction.id });
    }
    return result.transaction;
}

export async function voidTransaction(id: number, userId: string, reason: string | null, actor = 'USER') {
    const result = await prisma.$transaction(async (client) => {
        const existing = await client.transaction.findFirst({
            where: { id, userId },
            include: withSplits,
        });
        if (!existing) {
            throw new LedgerError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
        }
        if (existing.status === 'VOIDED') {
            return { transaction: existing, changed: false };
        }

        const voided = await client.transaction.update({
            where: { id: existing.id },
            data: { status: 'VOIDED', deletedAt: new Date(), voidReason: reason },
            include: withSplits,
        });
        await recordHistory(client, {
            transactionId: voided.id,
            userId,
            action: 'VOID',
            before: snapshotOf(existing),
            after: snapshotOf(voided),
            actor,
        });
        return { transaction: voided, changed: true };
    });

    if (result.changed) {
        emitLedgerEvent({ type: 'transaction.voided', userId, transactionId: result.transaction.id });
    }
    return result.transaction;
}

export async function restoreTransaction(id: number, userId: string, actor = 'USER') {
    const result = await prisma.$transaction(async (client) => {
        const existing = await client.transaction.findFirst({
            where: { id, userId },
            include: withSplits,
        });
        if (!existing) {
            throw new LedgerError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
        }
        if (existing.status !== 'VOIDED') {
            throw new LedgerError(409, 'TRANSACTION_NOT_VOIDED', 'Only voided transactions can be restored');
        }

        const restored = await client.transaction.update({
            where: { id: existing.id },
            data: { status: 'COMPLETED', deletedAt: null, voidReason: null },
            include: withSplits,
        });
        await recordHistory(client, {
            transactionId: restored.id,
            userId,
            action: 'RESTORE',
            before: snapshotOf(existing),
            after: snapshotOf(restored),
            actor,
        });
        return restored;
    });

    emitLedgerEvent({ type: 'transaction.restored', userId, transactionId: result.id });
    return result;
}

/**
 * Largest-remainder allocation: distributes `total` across `weights` so the parts
 * sum exactly to `total` and no fractional paise are lost. Used by percentage
 * split lines (bill splitting, automation) so rounding never unbalances a post.
 */
export function allocateByWeights(total: bigint, weights: number[]): bigint[] {
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    if (weightSum <= 0) {
        throw new LedgerError(400, 'INVALID_WEIGHTS', 'Split weights must add up to a positive number');
    }

    const raw = weights.map((weight) => (Number(total) * weight) / weightSum);
    const floored = raw.map((value) => BigInt(Math.trunc(value)));
    let remainder = total - floored.reduce((sum, value) => sum + value, BigInt(0));

    const order = raw
        .map((value, index) => ({ index, fraction: value - Math.trunc(value) }))
        .sort((a, b) => b.fraction - a.fraction);

    const result = [...floored];
    const step = remainder >= BigInt(0) ? BigInt(1) : BigInt(-1);
    let cursor = 0;
    while (remainder !== BigInt(0) && order.length > 0) {
        const target = order[cursor % order.length].index;
        result[target] += step;
        remainder -= step;
        cursor += 1;
    }
    return result;
}
