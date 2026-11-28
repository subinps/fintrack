import { prisma } from '../lib/prisma';
import { startOfUtcDay } from './recurring';

export interface DateRange {
    from: Date;
    /** Exclusive upper bound: the start of the day after the last included day */
    to: Date;
}

export interface ReportLine {
    accountId: number;
    name: string;
    type: string;
    subType: string | null;
    /** Natural balance: debit-positive for assets and expenses, credit-positive for the rest */
    amountPaise: bigint;
}

function nextDay(date: Date): Date {
    return new Date(startOfUtcDay(date).getTime() + 86_400_000);
}

export function rangeForMonth(month: string): DateRange {
    const [year, monthIndex] = month.split('-').map(Number);
    const from = new Date(Date.UTC(year, (monthIndex ?? 1) - 1, 1));
    return { from, to: new Date(Date.UTC(year, monthIndex ?? 1, 1)) };
}

export function rangeForFinancialYear(startYear: number): DateRange {
    // Indian financial year: 1 April to 31 March
    return { from: new Date(Date.UTC(startYear, 3, 1)), to: new Date(Date.UTC(startYear + 1, 3, 1)) };
}

function natural(type: string, raw: bigint): bigint {
    return type === 'ASSET' || type === 'EXPENSE' ? raw : -raw;
}

async function balancesByAccount(userId: string, range?: DateRange): Promise<Map<number, bigint>> {
    const grouped = await prisma.transactionSplit.groupBy({
        by: ['accountId'],
        where: {
            account: { userId },
            transaction: {
                userId,
                status: 'COMPLETED',
                deletedAt: null,
                ...(range ? { date: { gte: range.from, lt: range.to } } : {}),
            },
        },
        _sum: { amount: true },
    });
    return new Map(grouped.map((row) => [row.accountId, row._sum.amount ?? 0n]));
}

async function accountsOf(userId: string) {
    return prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true, type: true, subType: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
}

export async function trialBalance(userId: string, asOf: Date = new Date()): Promise<{ rows: ReportLine[]; totalDebitPaise: bigint; totalCreditPaise: bigint }> {
    const range = { from: new Date(0), to: nextDay(asOf) };
    const [accounts, balances] = await Promise.all([accountsOf(userId), balancesByAccount(userId, range)]);

    const rows = accounts
        .map((account) => {
            const raw = balances.get(account.id) ?? 0n;
            return { ...account, accountId: account.id, amountPaise: natural(account.type, raw), rawPaise: raw };
        })
        .filter((row) => row.rawPaise !== 0n)
        .map(({ rawPaise, ...row }) => row);

    let totalDebit = 0n;
    let totalCredit = 0n;
    for (const row of rows) {
        if (row.amountPaise >= 0n) totalDebit += row.amountPaise;
        else totalCredit += -row.amountPaise;
    }
    return { rows, totalDebitPaise: totalDebit, totalCreditPaise: totalCredit };
}

export interface BalanceSheet {
    asOf: Date;
    assets: ReportLine[];
    liabilities: ReportLine[];
    equity: ReportLine[];
    totalAssetsPaise: bigint;
    totalLiabilitiesPaise: bigint;
    totalEquityPaise: bigint;
    netWorthPaise: bigint;
    retainedEarningsPaise: bigint;
}

export async function balanceSheet(userId: string, asOf: Date = new Date()): Promise<BalanceSheet> {
    const range = { from: new Date(0), to: nextDay(asOf) };
    const [accounts, balances] = await Promise.all([accountsOf(userId), balancesByAccount(userId, range)]);

    const pick = (types: string[]): ReportLine[] =>
        accounts
            .filter((account) => types.includes(account.type))
            .map((account) => ({ ...account, accountId: account.id, amountPaise: natural(account.type, balances.get(account.id) ?? 0n) }))
            .filter((row) => row.amountPaise !== 0n);

    const assets = pick(['ASSET']);
    const liabilities = pick(['LIABILITY']);
    const equity = pick(['EQUITY']);
    const income = pick(['INCOME']);
    const expenses = pick(['EXPENSE']);

    const total = (rows: ReportLine[]) => rows.reduce((sum, row) => sum + row.amountPaise, 0n);
    const totalAssets = total(assets);
    const totalLiabilities = total(liabilities);
    const retained = total(income) - total(expenses);
    const equityTotal = total(equity) + retained;

    return {
        asOf,
        assets,
        liabilities,
        equity,
        totalAssetsPaise: totalAssets,
        totalLiabilitiesPaise: totalLiabilities,
        totalEquityPaise: equityTotal,
        netWorthPaise: totalAssets - totalLiabilities,
        retainedEarningsPaise: retained,
    };
}

export interface ProfitLoss {
    from: Date;
    to: Date;
    income: ReportLine[];
    expenses: ReportLine[];
    totalIncomePaise: bigint;
    totalExpensePaise: bigint;
    netPaise: bigint;
    /** Expense accounts that make up the bulk of spending, largest first */
    topExpenses: ReportLine[];
}

export async function profitLoss(userId: string, range: DateRange): Promise<ProfitLoss> {
    const [accounts, balances] = await Promise.all([accountsOf(userId), balancesByAccount(userId, range)]);
    const rows = (types: string[]) =>
        accounts
            .filter((account) => types.includes(account.type))
            .map((account) => ({ ...account, accountId: account.id, amountPaise: natural(account.type, balances.get(account.id) ?? 0n) }))
            .filter((row) => row.amountPaise !== 0n);

    const income = rows(['INCOME']);
    const expenses = rows(['EXPENSE']);
    const totalIncome = income.reduce((sum, row) => sum + row.amountPaise, 0n);
    const totalExpense = expenses.reduce((sum, row) => sum + row.amountPaise, 0n);

    return {
        from: range.from,
        to: new Date(range.to.getTime() - 86_400_000),
        income,
        expenses,
        totalIncomePaise: totalIncome,
        totalExpensePaise: totalExpense,
        netPaise: totalIncome - totalExpense,
        topExpenses: [...expenses].sort((a, b) => Number(b.amountPaise - a.amountPaise)).slice(0, 8),
    };
}

export interface CashFlow {
    from: Date;
    to: Date;
    inflowPaise: bigint;
    outflowPaise: bigint;
    netPaise: bigint;
    byMonth: { month: string; inflowPaise: bigint; outflowPaise: bigint }[];
}

/** Cash flow counts movement on liquid asset accounts, not accrual income. */
export async function cashFlow(userId: string, range: DateRange): Promise<CashFlow> {
    const accounts = await prisma.account.findMany({
        where: { userId, type: 'ASSET', subType: { in: ['Bank', 'Cash', 'Wallet'] } },
        select: { id: true },
    });
    const ids = accounts.map((account) => account.id);

    const splits = await prisma.transactionSplit.findMany({
        where: {
            accountId: { in: ids },
            transaction: { userId, status: 'COMPLETED', deletedAt: null, date: { gte: range.from, lt: range.to } },
        },
        select: { amount: true, transaction: { select: { date: true } } },
    });

    let inflow = 0n;
    let outflow = 0n;
    const months = new Map<string, { inflowPaise: bigint; outflowPaise: bigint }>();

    for (const split of splits) {
        const key = split.transaction.date.toISOString().slice(0, 7);
        const bucket = months.get(key) ?? { inflowPaise: 0n, outflowPaise: 0n };
        if (split.amount >= 0n) {
            inflow += split.amount;
            bucket.inflowPaise += split.amount;
        } else {
            outflow += -split.amount;
            bucket.outflowPaise += -split.amount;
        }
        months.set(key, bucket);
    }

    return {
        from: range.from,
        to: new Date(range.to.getTime() - 86_400_000),
        inflowPaise: inflow,
        outflowPaise: outflow,
        netPaise: inflow - outflow,
        byMonth: [...months.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, bucket]) => ({ month, ...bucket })),
    };
}

export async function spendingByCategory(userId: string, range: DateRange): Promise<ReportLine[]> {
    const [accounts, balances] = await Promise.all([accountsOf(userId), balancesByAccount(userId, range)]);
    return accounts
        .filter((account) => account.type === 'EXPENSE')
        .map((account) => ({ ...account, accountId: account.id, amountPaise: balances.get(account.id) ?? 0n }))
        .filter((row) => row.amountPaise !== 0n)
        .sort((a, b) => Number(b.amountPaise - a.amountPaise));
}

export async function netWorthNow(userId: string, asOf: Date = new Date()): Promise<bigint> {
    const sheet = await balanceSheet(userId, asOf);
    return sheet.netWorthPaise;
}
