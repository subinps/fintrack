import { prisma } from '../lib/prisma';
import { zonedDayStart } from '../lib/dates';

const INVESTMENT_SUBTYPES = ['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'];

export interface NetWorthTotals {
    /** All values are integer paise. */
    assets: number;
    liabilities: number;
    netWorth: number;
}

const totalsFor = (accounts: { id: number; type: string }[], balances: Map<number, number>): NetWorthTotals => {
    let assets = 0;
    let liabilities = 0;

    for (const account of accounts) {
        const value = balances.get(account.id) ?? 0;
        if (account.type === 'ASSET') {
            assets += value;
        } else if (account.type === 'LIABILITY') {
            liabilities += Math.abs(value);
        }
    }

    return {
        assets: Math.round(assets),
        liabilities: Math.round(liabilities),
        netWorth: Math.round(assets - liabilities),
    };
};

/**
 * Single source of truth for net worth. Only COMPLETED, non-voided splits count.
 * With `asOf`, the ledger is read up to that instant and investments are valued at
 * balance (cost basis), because no historical market prices are stored.
 */
export async function computeNetWorth(userId: string, asOf?: Date): Promise<NetWorthTotals> {
    const [accounts, balanceRows] = await Promise.all([
        prisma.account.findMany({
            where: { userId },
            select: { id: true, type: true, subType: true, symbol: true, units: true, lastMarketPrice: true },
        }),
        prisma.transactionSplit.groupBy({
            by: ['accountId'],
            where: {
                account: { userId },
                transaction: {
                    status: 'COMPLETED',
                    deletedAt: null,
                    ...(asOf ? { date: { lte: asOf } } : {}),
                },
            },
            _sum: { amount: true },
        }),
    ]);

    const balances = new Map(balanceRows.map((row) => [row.accountId, Number(row._sum.amount ?? BigInt(0))]));

    if (asOf) {
        return totalsFor(accounts, balances);
    }

    const symbols = [...new Set(accounts.map((account) => account.symbol?.toUpperCase()).filter(Boolean))] as string[];
    const prices = symbols.length
        ? await prisma.marketPrice.findMany({ where: { symbol: { in: symbols } } })
        : [];
    const priceMap = new Map(prices.map((price) => [price.symbol.toUpperCase(), Number(price.price)]));

    for (const account of accounts) {
        if (
            account.type === 'ASSET' &&
            INVESTMENT_SUBTYPES.includes(account.subType || '') &&
            account.units
        ) {
            const symbol = account.symbol?.toUpperCase();
            const price = symbol ? priceMap.get(symbol) : undefined;
            if (price !== undefined) {
                balances.set(account.id, price * account.units * 100);
            } else if (account.lastMarketPrice) {
                balances.set(account.id, Number(account.lastMarketPrice) * account.units * 100);
            }
        }
    }

    return totalsFor(accounts, balances);
}

/**
 * Snapshot for the calendar day that contains `at`, in the given timezone (upsert, so
 * repeated recomputes on the same day overwrite rather than duplicate).
 */
export async function snapshotNetWorthAsOf(userId: string, at: Date, timeZone: string) {
    const date = zonedDayStart(at, timeZone);
    const totals = await computeNetWorth(userId, at);

    const snapshot = await prisma.netWorthSnapshot.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, ...totals },
        update: totals,
    });

    return { snapshot, totals };
}

/** Snapshot for the user's local today. Returns null when the user is gone. */
export async function snapshotNetWorth(userId: string, at = new Date()) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    if (!user) return null;

    return snapshotNetWorthAsOf(userId, at, user.timezone);
}
