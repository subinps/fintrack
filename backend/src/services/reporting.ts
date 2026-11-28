import { prisma } from '../lib/prisma';
import { formatPaise, rupeesToPaise } from '../lib/money';

/**
 * Phase 6: financial statements. Everything is derived from TransactionSplit,
 * so any transaction — manual, imported, recurring or automated — is included.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';

interface RawSplit {
    accountId: number;
    amount: bigint;
    accountType: AccountType;
    accountName: string;
    accountSubType: string | null;
}

const loadSplits = async (userId: string, from?: Date, to?: Date): Promise<RawSplit[]> => {
    const splits = await prisma.transactionSplit.findMany({
        where: {
            transaction: {
                userId,
                status: { not: 'VOIDED' },
                ...(from || to
                    ? {
                          date: {
                              ...(from ? { gte: from } : {}),
                              ...(to ? { lte: to } : {}),
                          },
                      }
                    : {}),
            },
        },
        select: { accountId: true, amount: true, account: { select: { name: true, type: true, subType: true } } },
    });
    return splits.map((split) => ({
        accountId: split.accountId,
        amount: split.amount,
        accountType: split.account.type as AccountType,
        accountName: split.account.name,
        accountSubType: split.account.subType,
    }));
};

export interface StatementLine {
    accountId: number;
    name: string;
    type: AccountType;
    amount: string;
    previous?: string;
    change?: string | null;
}

export interface ProfitAndLoss {
    from: string;
    to: string;
    income: StatementLine[];
    expenses: StatementLine[];
    totalIncome: string;
    totalExpenses: string;
    netProfit: string;
    marginPercent: number | null;
    prior: { totalIncome: string; totalExpenses: string; netProfit: string } | null;
}

const iso = (date: Date): string => date.toISOString().slice(0, 10);

const totalsByAccount = (splits: RawSplit[], type: AccountType): Map<number, { name: string; subType: string | null; amount: bigint }> => {
    const map = new Map<number, { name: string; subType: string | null; amount: bigint }>();
    for (const split of splits) {
        if (split.accountType !== type) continue;
        const current = map.get(split.accountId) ?? { name: split.accountName, subType: split.accountSubType, amount: 0n };
        current.amount += split.amount;
        map.set(split.accountId, current);
    }
    return map;
};

const linesFrom = (map: Map<number, { name: string; subType: string | null; amount: bigint }>, type: AccountType): StatementLine[] =>
    [...map.entries()]
        .map(([accountId, value]) => ({
            accountId,
            name: value.name,
            type,
            amount: formatPaise(type === 'INCOME' ? -value.amount : value.amount),
        }))
        .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));

export async function profitAndLoss(userId: string, from: Date, to: Date, compare = false): Promise<ProfitAndLoss> {
    const splits = await loadSplits(userId, from, to);
    const income = linesFrom(totalsByAccount(splits, 'INCOME'), 'INCOME');
    const expenses = linesFrom(totalsByAccount(splits, 'EXPENSE'), 'EXPENSE');
    const totalIncome = income.reduce((sum, line) => sum + rupeesToPaise(line.amount), 0n);
    const totalExpenses = expenses.reduce((sum, line) => sum + rupeesToPaise(line.amount), 0n);
    const net = totalIncome - totalExpenses;

    let prior: ProfitAndLoss['prior'] = null;
    if (compare) {
        const span = to.getTime() - from.getTime();
        const priorTo = new Date(from.getTime() - 1);
        const priorFrom = new Date(priorTo.getTime() - span);
        const priorSplits = await loadSplits(userId, priorFrom, priorTo);
        const priorIncome = linesFrom(totalsByAccount(priorSplits, 'INCOME'), 'INCOME').reduce((sum, line) => sum + rupeesToPaise(line.amount), 0n);
        const priorExpenses = linesFrom(totalsByAccount(priorSplits, 'EXPENSE'), 'EXPENSE').reduce((sum, line) => sum + rupeesToPaise(line.amount), 0n);
        prior = {
            totalIncome: formatPaise(priorIncome),
            totalExpenses: formatPaise(priorExpenses),
            netProfit: formatPaise(priorIncome - priorExpenses),
        };
    }

    return {
        from: iso(from),
        to: iso(to),
        income,
        expenses,
        totalIncome: formatPaise(totalIncome),
        totalExpenses: formatPaise(totalExpenses),
        netProfit: formatPaise(net),
        marginPercent: totalIncome === 0n ? null : Math.round(Number((net * 10000n) / totalIncome)) / 100,
        prior,
    };
}

export interface BalanceSheet {
    asOf: string;
    assets: StatementLine[];
    liabilities: StatementLine[];
    equity: StatementLine[];
    totalAssets: string;
    totalLiabilities: string;
    totalEquity: string;
    retainedEarnings: string;
    totalLiabilitiesAndEquity: string;
    balanced: boolean;
}

export async function balanceSheet(userId: string, asOf: Date): Promise<BalanceSheet> {
    const start = new Date('1970-01-01T00:00:00Z');
    const splits = await loadSplits(userId, start, new Date(`${iso(asOf)}T23:59:59Z`));
    const assetMap = totalsByAccount(splits, 'ASSET');
    const liabilityMap = totalsByAccount(splits, 'LIABILITY');
    const equityMap = totalsByAccount(splits, 'EQUITY');
    const incomeMap = totalsByAccount(splits, 'INCOME');
    const expenseMap = totalsByAccount(splits, 'EXPENSE');

    const assets = linesFrom(assetMap, 'ASSET');
    const liabilities = linesFrom(liabilityMap, 'LIABILITY').map((line) => ({ ...line, amount: formatPaise(-rupeesToPaise(line.amount)) }));
    const equity = linesFrom(equityMap, 'EQUITY').map((line) => ({ ...line, amount: formatPaise(-rupeesToPaise(line.amount)) }));

    const sum = (map: Map<number, { amount: bigint }>) => [...map.values()].reduce((total, value) => total + value.amount, 0n);
    const incomeTotal = -sum(incomeMap);
    const expenseTotal = sum(expenseMap);
    const retained = incomeTotal - expenseTotal;

    const totalAssets = assets.reduce((total, line) => total + rupeesToPaise(line.amount), 0n);
    const totalLiabilities = liabilities.reduce((total, line) => total + rupeesToPaise(line.amount), 0n);
    const totalEquity = equity.reduce((total, line) => total + rupeesToPaise(line.amount), 0n);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + retained;

    return {
        asOf: iso(asOf),
        assets,
        liabilities,
        equity,
        totalAssets: formatPaise(totalAssets),
        totalLiabilities: formatPaise(totalLiabilities),
        totalEquity: formatPaise(totalEquity),
        retainedEarnings: formatPaise(retained),
        totalLiabilitiesAndEquity: formatPaise(totalLiabilitiesAndEquity),
        balanced: totalAssets === totalLiabilitiesAndEquity,
    };
}

export interface CashFlowSection {
    inflow: string;
    outflow: string;
    net: string;
    items: { name: string; amount: string }[];
}

export interface CashFlow {
    from: string;
    to: string;
    opening: string;
    closing: string;
    net: string;
    operating: CashFlowSection;
    investing: CashFlowSection;
    financing: CashFlowSection;
}

const CASH_SUBTYPES = new Set(['cash', 'bank', 'savings', 'checking', 'wallet', 'cashbox']);

/** Cash accounts: liquid assets. Anything with units (investments) is excluded. */
export async function cashAccounts(userId: string): Promise<number[]> {
    const accounts = await prisma.account.findMany({
        where: { userId, type: 'ASSET' },
        select: { id: true, subType: true, units: true, symbol: true },
    });
    return accounts
        .filter((account) => !account.units && !account.symbol)
        .filter((account) => !account.subType || CASH_SUBTYPES.has(account.subType.toLowerCase()) || account.subType === 'BANK')
        .map((account) => account.id);
}

export async function cashFlow(userId: string, from: Date, to: Date): Promise<CashFlow> {
    const cashIds = await cashAccounts(userId);
    if (cashIds.length === 0) {
        const empty = { inflow: '0', outflow: '0', net: '0', items: [] };
        return { from: iso(from), to: iso(to), opening: '0', closing: '0', net: '0', operating: empty, investing: empty, financing: empty };
    }

    const [before, during] = await Promise.all([
        prisma.transactionSplit.findMany({
            where: { accountId: { in: cashIds }, transaction: { userId, status: { not: 'VOIDED' }, date: { lt: from } } },
            select: { amount: true },
        }),
        prisma.transaction.findMany({
            where: { userId, status: { not: 'VOIDED' }, date: { gte: from, lte: to } },
            select: {
                id: true,
                description: true,
                splits: { select: { accountId: true, amount: true, account: { select: { type: true, subType: true, name: true } } } },
            },
        }),
    ]);

    const opening = before.reduce((sum, split) => sum + split.amount, 0n);
    const sections: Record<'operating' | 'investing' | 'financing', Map<string, bigint>> = {
        operating: new Map(),
        investing: new Map(),
        financing: new Map(),
    };

    for (const transaction of during) {
        const cashLegs = transaction.splits.filter((split) => cashIds.includes(split.accountId));
        if (cashLegs.length === 0) continue;
        const cashAmount = cashLegs.reduce((sum, split) => sum + split.amount, 0n);
        if (cashAmount === 0n) continue;
        const counter = transaction.splits.filter((split) => !cashIds.includes(split.accountId));
        let bucket: 'operating' | 'investing' | 'financing' = 'operating';
        if (counter.length > 0 && counter.every((split) => split.account.type === 'ASSET')) bucket = 'investing';
        else if (counter.length > 0 && counter.every((split) => split.account.type === 'LIABILITY' || split.account.type === 'EQUITY')) bucket = 'financing';
        const label = counter[0]?.account.name ?? 'Uncategorised';
        sections[bucket].set(label, (sections[bucket].get(label) ?? 0n) + cashAmount);
    }

    const build = (map: Map<string, bigint>): CashFlowSection => {
        let inflow = 0n;
        let outflow = 0n;
        const items = [...map.entries()]
            .map(([name, amount]) => {
                if (amount >= 0n) inflow += amount;
                else outflow += -amount;
                return { name, amount: formatPaise(amount) };
            })
            .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
            .slice(0, 12);
        return { inflow: formatPaise(inflow), outflow: formatPaise(outflow), net: formatPaise(inflow - outflow), items };
    };

    const operating = build(sections.operating);
    const investing = build(sections.investing);
    const financing = build(sections.financing);
    const net = rupeesToPaise(operating.net) + rupeesToPaise(investing.net) + rupeesToPaise(financing.net);

    return {
        from: iso(from),
        to: iso(to),
        opening: formatPaise(opening),
        closing: formatPaise(opening + net),
        net: formatPaise(net),
        operating,
        investing,
        financing,
    };
}

export interface TrialBalance {
    asOf: string;
    rows: { accountId: number; name: string; type: AccountType; debit: string; credit: string }[];
    totalDebit: string;
    totalCredit: string;
    balanced: boolean;
}

export async function trialBalance(userId: string, asOf: Date): Promise<TrialBalance> {
    const splits = await loadSplits(userId, new Date('1970-01-01T00:00:00Z'), new Date(`${iso(asOf)}T23:59:59Z`));
    const map = new Map<number, { name: string; type: AccountType; amount: bigint }>();
    for (const split of splits) {
        const current = map.get(split.accountId) ?? { name: split.accountName, type: split.accountType, amount: 0n };
        current.amount += split.amount;
        map.set(split.accountId, current);
    }
    let debit = 0n;
    let credit = 0n;
    const rows = [...map.entries()]
        .map(([accountId, value]) => {
            if (value.amount >= 0n) debit += value.amount;
            else credit += -value.amount;
            return {
                accountId,
                name: value.name,
                type: value.type,
                debit: value.amount > 0n ? formatPaise(value.amount) : '0',
                credit: value.amount < 0n ? formatPaise(-value.amount) : '0',
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    return { asOf: iso(asOf), rows, totalDebit: formatPaise(debit), totalCredit: formatPaise(credit), balanced: debit === credit };
}
