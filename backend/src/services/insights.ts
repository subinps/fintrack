import { prisma } from '../lib/prisma';
import { formatPaise } from '../lib/money';
import { cashAccounts } from './reporting';

/** Phase 10: search, insight cards and the monthly digest. */

export interface Insight {
    id: string;
    tone: 'positive' | 'neutral' | 'warning';
    title: string;
    detail: string;
    action?: { label: string; tab: string };
    amount?: string;
}

/** Prose formatter: ₹2,22,803 with Indian digit grouping. */
const rupees = (paise: bigint): string => {
    const negative = paise < 0n;
    const value = Number(negative ? -paise : paise) / 100;
    return `${negative ? '-' : ''}₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const monthBounds = (offset = 0) => {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0, 23, 59, 59));
    return { from, to };
};

const sumByType = async (userId: string, type: 'INCOME' | 'EXPENSE', from: Date, to: Date): Promise<bigint> => {
    const splits = await prisma.transactionSplit.findMany({
        where: { account: { userId, type }, transaction: { userId, status: { not: 'VOIDED' }, date: { gte: from, lte: to } } },
        select: { amount: true },
    });
    const total = splits.reduce((sum, split) => sum + split.amount, 0n);
    return type === 'INCOME' ? -total : total;
};

export async function insights(userId: string): Promise<{ insights: Insight[]; generatedAt: string }> {
    const current = monthBounds(0);
    const previous = monthBounds(-1);
    const threeAgo = monthBounds(-3);

    const [incomeNow, expenseNow, expensePrev, expenseThree, cashIds, runningRules, budgets] = await Promise.all([
        sumByType(userId, 'INCOME', current.from, current.to),
        sumByType(userId, 'EXPENSE', current.from, current.to),
        sumByType(userId, 'EXPENSE', previous.from, previous.to),
        sumByType(userId, 'EXPENSE', threeAgo.from, previous.to),
        cashAccounts(userId),
        prisma.recurringRule.findMany({
            where: { userId, isActive: true, deletedAt: null },
            select: { id: true, name: true, nextRunAt: true, template: true },
            orderBy: { nextRunAt: 'asc' },
        }),
        prisma.budget.findMany({
            where: { userId, deletedAt: null },
            include: { items: { select: { accountId: true, amountPaise: true } } },
        }),
    ]);

    const cards: Insight[] = [];

    if (incomeNow > 0n) {
        const savings = incomeNow - expenseNow;
        const rate = Math.round((Number(savings) / Number(incomeNow)) * 1000) / 10;
        cards.push({
            id: 'savings-rate',
            tone: rate >= 20 ? 'positive' : rate >= 0 ? 'neutral' : 'warning',
            title: `${rate}% saved this month`,
            detail: savings >= 0n
                ? `You kept ${rupees(savings)} of ${rupees(incomeNow)} income.`
                : `You spent ${rupees(-savings)} more than you earned.`,
            action: { label: 'Open reports', tab: 'reports' },
            amount: formatPaise(savings),
        });
    }

    if (expensePrev > 0n) {
        const delta = expenseNow - expensePrev;
        const percent = Math.round((Number(delta) / Number(expensePrev)) * 1000) / 10;
        cards.push({
            id: 'spend-mom',
            tone: delta > 0n ? 'warning' : 'positive',
            title: percent === 0 ? 'Spending is flat month on month' : `Spending ${percent > 0 ? 'up' : 'down'} ${Math.abs(percent)}% vs last month`,
            detail: `${rupees(expenseNow)} so far this month against ${rupees(expensePrev)} last month.`,
            action: { label: 'See categories', tab: 'charts' },
            amount: formatPaise(delta),
        });
    }

    if (expenseThree > 0n) {
        const burn = expenseThree / 3n;
        const cashSplits = await prisma.transactionSplit.findMany({
            where: { accountId: { in: cashIds }, transaction: { userId, status: { not: 'VOIDED' } } },
            select: { amount: true },
        });
        const cash = cashSplits.reduce((sum, split) => sum + split.amount, 0n);
        if (burn > 0n) {
            const runway = Math.round((Number(cash) / Number(burn)) * 10) / 10;
            cards.push({
                id: 'runway',
                tone: runway < 3 ? 'warning' : runway > 6 ? 'positive' : 'neutral',
                title: `${runway} months of runway`,
                detail: `Liquid cash ${rupees(cash)} covers an average monthly spend of ${rupees(burn)}.`,
                action: { label: 'Review budget', tab: 'budgets' },
            });
        }
    }

    const recurringMonthly = runningRules.length;
    if (recurringMonthly > 0) {
        const next = runningRules[0].nextRunAt.toISOString().slice(0, 10);
        cards.push({
            id: 'recurring',
            tone: 'neutral',
            title: `${recurringMonthly} recurring ${recurringMonthly === 1 ? 'entry' : 'entries'} running`,
            detail: `Next one is “${runningRules[0].name}” on ${next}.`,
            action: { label: 'Open recurring', tab: 'recurring' },
        });
    }

    for (const budget of budgets) {
        const total = budget.items.reduce((sum, item) => sum + item.amountPaise, 0n);
        if (total === 0n) continue;
        const spentSplits = await prisma.transactionSplit.findMany({
            where: {
                account: { userId, type: 'EXPENSE' },
                accountId: { in: budget.items.map((item) => item.accountId).filter((id): id is number => typeof id === 'number') },
                transaction: { userId, status: { not: 'VOIDED' }, date: { gte: current.from, lte: current.to } },
            },
            select: { amount: true },
        });
        const spent = spentSplits.reduce((sum, split) => sum + split.amount, 0n);
        if (spent > total) {
            cards.push({
                id: `budget-${budget.id}`,
                tone: 'warning',
                title: `${budget.name} is over budget`,
                detail: `${rupees(spent)} spent against ${rupees(total)} planned this month.`,
                action: { label: 'Adjust budget', tab: 'budgets' },
                amount: formatPaise(spent - total),
            });
        }
    }

    return { insights: cards.slice(0, 6), generatedAt: new Date().toISOString() };
}

export interface SearchResults {
    query: string;
    transactions: { id: number; date: string; description: string; amount: string; accountName: string | null; tags: string[] }[];
    accounts: { id: number; name: string; type: string; balance: string }[];
    totals: { transactions: number; accounts: number };
}

export async function search(userId: string, query: string): Promise<SearchResults> {
    const term = query.trim();
    if (term.length < 2) return { query: term, transactions: [], accounts: [], totals: { transactions: 0, accounts: 0 } };

    const numeric = Number(term.replace(/[^\d.]/g, ''));
    const amountFilter = Number.isFinite(numeric) && numeric > 0 ? BigInt(Math.round(numeric * 100)) : null;

    const [transactions, accounts] = await Promise.all([
        prisma.transaction.findMany({
            where: {
                userId,
                status: { not: 'VOIDED' },
                OR: [
                    { description: { contains: term, mode: 'insensitive' } },
                    { tags: { has: term.toLowerCase() } },
                    ...(amountFilter !== null
                        ? [{ splits: { some: { amount: { in: [amountFilter, -amountFilter] } } } }]
                        : []),
                ],
            },
            include: { splits: { include: { account: { select: { name: true, type: true } } } } },
            orderBy: { date: 'desc' },
            take: 25,
        }),
        prisma.account.findMany({
            where: { userId, name: { contains: term, mode: 'insensitive' } },
            take: 8,
        }),
    ]);

    const balanceRows = await prisma.transactionSplit.groupBy({
        by: ['accountId'],
        where: { accountId: { in: accounts.map((account) => account.id) }, transaction: { userId, status: { not: 'VOIDED' } } },
        _sum: { amount: true },
    });
    const balances = new Map(balanceRows.map((row) => [row.accountId, row._sum.amount ?? 0n]));

    return {
        query: term,
        transactions: transactions.map((transaction) => {
            const main = transaction.splits.find((split) => split.account.type !== 'INCOME' && split.account.type !== 'EXPENSE') ?? transaction.splits[0];
            return {
                id: transaction.id,
                date: transaction.date.toISOString().slice(0, 10),
                description: transaction.description,
                amount: formatPaise(main?.amount ?? 0n),
                accountName: main?.account.name ?? null,
                tags: transaction.tags,
            };
        }),
        accounts: accounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
            balance: formatPaise(balances.get(account.id) ?? 0n),
        })),
        totals: { transactions: transactions.length, accounts: accounts.length },
    };
}

export async function digest(userId: string) {
    const { from, to } = monthBounds(0);
    const { from: prevFrom, to: prevTo } = monthBounds(-1);
    const [income, expense, prevExpense, topCategories] = await Promise.all([
        sumByType(userId, 'INCOME', from, to),
        sumByType(userId, 'EXPENSE', from, to),
        sumByType(userId, 'EXPENSE', prevFrom, prevTo),
        prisma.transactionSplit.groupBy({
            by: ['accountId'],
            where: { account: { userId, type: 'EXPENSE' }, transaction: { userId, status: { not: 'VOIDED' }, date: { gte: from, lte: to } } },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: 5,
        }),
    ]);
    const names = await prisma.account.findMany({ where: { id: { in: topCategories.map((row) => row.accountId) } }, select: { id: true, name: true } });
    const nameById = new Map(names.map((account) => [account.id, account.name]));
    return {
        month: from.toISOString().slice(0, 7),
        income: formatPaise(income),
        expense: formatPaise(expense),
        net: formatPaise(income - expense),
        previousExpense: formatPaise(prevExpense),
        changePercent: prevExpense > 0n ? Math.round((Number(expense - prevExpense) / Number(prevExpense)) * 1000) / 10 : null,
        topCategories: topCategories.map((row) => ({ name: nameById.get(row.accountId) ?? 'Unknown', amount: formatPaise(row._sum.amount ?? 0n) })),
    };
}
