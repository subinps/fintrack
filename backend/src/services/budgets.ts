import { Prisma, type Budget, type BudgetItem } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createNotification } from './notifications';
import { dayKey, startOfUtcDay } from './recurring';
import { formatPaise } from '../lib/money';

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
export type BudgetType = 'FIXED' | 'PERCENT_INCOME' | 'ZERO_BASED' | 'ENVELOPE';

export interface PeriodWindow {
    start: Date;
    end: Date;
}

const MONTHS_IN_YEAR = 12;

function startOfWeek(date: Date): Date {
    const start = startOfUtcDay(date);
    const day = start.getUTCDay(); // 0 Sun .. 6 Sat
    const offset = (day + 6) % 7; // Monday = 0
    return new Date(start.getTime() - offset * 86_400_000);
}

function addMonths(date: Date, months: number): Date {
    const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    return result;
}

function alignedMonthStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** The period that contains `date`, aligned to calendar boundaries (custom budgets use their own range). */
export function windowContaining(period: BudgetPeriod, date: Date, budget?: Pick<Budget, 'startDate' | 'endDate'>): PeriodWindow {
    const day = startOfUtcDay(date);
    switch (period) {
        case 'WEEKLY': {
            const start = startOfWeek(day);
            return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
        }
        case 'MONTHLY': {
            const start = alignedMonthStart(day);
            return { start, end: addMonths(start, 1) };
        }
        case 'QUARTERLY': {
            const start = new Date(Date.UTC(day.getUTCFullYear(), Math.floor(day.getUTCMonth() / 3) * 3, 1));
            return { start, end: addMonths(start, 3) };
        }
        case 'YEARLY': {
            const start = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
            return { start, end: new Date(Date.UTC(day.getUTCFullYear() + 1, 0, 1)) };
        }
        case 'CUSTOM':
        default: {
            const start = budget ? startOfUtcDay(budget.startDate) : alignedMonthStart(day);
            const end = budget?.endDate ? startOfUtcDay(budget.endDate) : new Date(start.getTime() + 30 * 86_400_000);
            return { start, end: end.getTime() > start.getTime() ? end : new Date(start.getTime() + 86_400_000) };
        }
    }
}

/** Chronological windows of this budget before the one containing `date` (most recent first, capped). */
export function previousWindows(period: BudgetPeriod, date: Date, budget: Pick<Budget, 'startDate' | 'endDate'>, maxPeriods = 24): PeriodWindow[] {
    const windows: PeriodWindow[] = [];
    let cursor = windowContaining(period, date, budget).start;
    const notBefore = startOfUtcDay(budget.startDate);

    for (let guard = 0; guard < maxPeriods; guard += 1) {
        if (cursor.getTime() <= notBefore.getTime()) break;
        const previousEnd = cursor;
        const previous = windowContaining(period, new Date(cursor.getTime() - 86_400_000), budget);
        if (previous.start.getTime() >= previousEnd.getTime()) break;
        windows.push({ start: previous.start, end: previousEnd });
        cursor = previous.start;
    }

    return windows;
}

export function daysBetween(from: Date, to: Date): number {
    return Math.max(0, Math.ceil((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / 86_400_000));
}

/**
 * Net movement on an expense category: positive means money spent.
 * Expense accounts debit with positive amounts; asset/liability outflows are credits (negative).
 */
async function spendInWindow(accountId: number | null, accountType: string | null, tag: string | null, window: PeriodWindow): Promise<bigint> {
    if (!accountId && !tag) return 0n;

    const where: Prisma.TransactionSplitWhereInput = {
        transaction: {
            status: 'COMPLETED',
            deletedAt: null,
            date: { gte: window.start, lt: window.end },
            ...(tag ? { tags: { has: tag } } : {}),
        },
    };
    if (accountId) where.accountId = accountId;
    else where.account = { type: 'EXPENSE' };

    const aggregate = await prisma.transactionSplit.aggregate({ where, _sum: { amount: true } });
    const sum = aggregate._sum.amount ?? 0n;
    return accountType && accountType !== 'EXPENSE' ? -sum : sum;
}

/** Income posted in the period, used by PERCENT_INCOME budgets and summaries. */
export async function incomeInWindow(userId: string, window: PeriodWindow): Promise<bigint> {
    const aggregate = await prisma.transactionSplit.aggregate({
        where: {
            account: { userId, type: 'INCOME' },
            transaction: { userId, status: 'COMPLETED', deletedAt: null, date: { gte: window.start, lt: window.end } },
        },
        _sum: { amount: true },
    });
    return -(aggregate._sum.amount ?? 0n);
}

export async function expenseInWindow(userId: string, window: PeriodWindow): Promise<bigint> {
    const aggregate = await prisma.transactionSplit.aggregate({
        where: {
            account: { userId, type: 'EXPENSE' },
            transaction: { userId, status: 'COMPLETED', deletedAt: null, date: { gte: window.start, lt: window.end } },
        },
        _sum: { amount: true },
    });
    return aggregate._sum.amount ?? 0n;
}

function baseLimit(item: Pick<BudgetItem, 'amountPaise' | 'percent'>, type: BudgetType, income: bigint): bigint {
    if (type === 'PERCENT_INCOME' && item.percent != null) {
        return BigInt(Math.round((Number(income) * item.percent) / 100));
    }
    return item.amountPaise;
}

interface AccountInfo {
    type: string;
    name: string;
}

async function accountIndex(userId: string): Promise<Map<number, AccountInfo>> {
    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true, name: true, type: true } });
    return new Map(accounts.map((account) => [account.id, { type: account.type, name: account.name }]));
}

interface TemplateLine {
    accountId: number;
    amountPaise: string;
}

/** Pending recurring bills that fall in the rest of the period and hit this item's account. */
async function upcomingCommitments(userId: string, accountId: number | null, window: PeriodWindow, now: Date): Promise<bigint> {
    if (!accountId) return 0n;
    const from = now.getTime() > window.start.getTime() ? startOfUtcDay(now) : window.start;
    if (from.getTime() >= window.end.getTime()) return 0n;

    const occurrences = await prisma.recurringOccurrence.findMany({
        where: {
            rule: { userId, isActive: true },
            status: 'PENDING',
            dueDate: { gte: from, lt: window.end },
        },
        include: { rule: { select: { template: true } } },
    });

    let total = 0n;
    for (const occurrence of occurrences) {
        const template = occurrence.rule.template as unknown as { lines?: TemplateLine[] } | null;
        for (const line of template?.lines ?? []) {
            if (Number(line.accountId) !== accountId) continue;
            const amount = BigInt(line.amountPaise);
            if (amount < 0n) total += -amount;
        }
    }
    return total;
}

export interface ItemStatus {
    id: string;
    name: string;
    accountId: number | null;
    accountName: string | null;
    tag: string | null;
    amountPaise: bigint;
    percent: number | null;
    limitPaise: bigint;
    spentPaise: bigint;
    rolloverPaise: bigint;
    remainingPaise: bigint;
    percentUsed: number;
    dailyAllowancePaise: bigint;
    projectedSpendPaise: bigint;
    upcomingPaise: bigint;
    pace: 'ON_TRACK' | 'WATCH' | 'OVER';
    alertAt: number[];
    parentId: string | null;
    children: ItemStatus[];
}

export interface BudgetStatus {
    id: string;
    name: string;
    period: BudgetPeriod;
    type: BudgetType;
    rollover: boolean;
    rolloverCapPaise: bigint | null;
    startDate: Date;
    endDate: Date | null;
    periodStart: Date;
    periodEnd: Date;
    daysLeft: number;
    totalLimitPaise: bigint;
    totalSpentPaise: bigint;
    totalRemainingPaise: bigint;
    percentUsed: number;
    rolloverPaise: bigint;
    incomePaise: bigint;
    unallocatedPaise: bigint | null;
    projectedOverspendPaise: bigint;
    pace: 'ON_TRACK' | 'WATCH' | 'OVER';
    items: ItemStatus[];
}

function paceFor(percentUsed: number, elapsedShare: number): 'ON_TRACK' | 'WATCH' | 'OVER' {
    if (percentUsed > 100) return 'OVER';
    if (percentUsed > elapsedShare * 100 + 12) return 'WATCH';
    return 'ON_TRACK';
}

export async function computeBudgetStatus(
    userId: string,
    budget: Budget & { items: BudgetItem[] },
    now: Date = new Date(),
    accounts?: Map<number, AccountInfo>
): Promise<BudgetStatus> {
    const window = windowContaining(budget.period as BudgetPeriod, now, budget);
    const type = budget.type as BudgetType;
    const income = await incomeInWindow(userId, window);
    const index = accounts ?? (await accountIndex(userId));

    const totalDays = Math.max(1, daysBetween(window.start, window.end));
    const elapsedDays = Math.min(totalDays, Math.max(0, daysBetween(window.start, now)));
    const elapsedShare = totalDays === 0 ? 1 : elapsedDays / totalDays;
    const daysLeft = Math.max(0, totalDays - elapsedDays);

    const priorWindows = previousWindows(budget.period as BudgetPeriod, budget.startDate > now ? budget.startDate : now, budget);

    const seen = new Set<string>();
    const items: ItemStatus[] = [];

    for (const item of budget.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);

        const info = item.accountId ? index.get(item.accountId) : undefined;
        const base = baseLimit(item, type, income);
        const spent = await spendInWindow(item.accountId, info?.type ?? null, item.tag, window);

        let rollover = 0n;
        if (budget.rollover) {
            for (const prior of priorWindows) {
                const priorSpent = await spendInWindow(item.accountId, info?.type ?? null, item.tag, prior);
                const remaining = base - priorSpent;
                rollover = rollover + remaining < 0n ? 0n : rollover + remaining;
                if (budget.rolloverCapPaise != null && rollover > budget.rolloverCapPaise) rollover = budget.rolloverCapPaise;
            }
        }

        const limit = base + rollover;
        const remaining = limit - spent;
        const percentUsed = limit > 0n ? Number((spent * 10_000n) / limit) / 100 : spent > 0n ? 100 : 0;
        const projected = elapsedDays > 0 ? (spent * BigInt(totalDays)) / BigInt(elapsedDays) : spent;
        const upcoming = await upcomingCommitments(userId, item.accountId, window, now);

        items.push({
            id: item.id,
            name: item.name ?? info?.name ?? item.tag ?? 'Unnamed category',
            accountId: item.accountId,
            accountName: info?.name ?? null,
            tag: item.tag,
            amountPaise: item.amountPaise,
            percent: item.percent,
            limitPaise: limit,
            spentPaise: spent,
            rolloverPaise: rollover,
            remainingPaise: remaining,
            percentUsed,
            dailyAllowancePaise: daysLeft > 0 && remaining > 0n ? remaining / BigInt(daysLeft) : 0n,
            projectedSpendPaise: projected,
            upcomingPaise: upcoming,
            pace: paceFor(percentUsed, elapsedShare),
            alertAt: item.alertAt,
            parentId: item.parentId,
            children: [],
        });
    }

    // Nest children under their parents; orphaned items stay at the top level.
    const byId = new Map(items.map((item) => [item.id, item]));
    const roots: ItemStatus[] = [];
    for (const item of items) {
        const parent = item.parentId ? byId.get(item.parentId) : undefined;
        if (parent) parent.children.push(item);
        else roots.push(item);
    }
    const rollUp = (item: ItemStatus): ItemStatus => {
        item.children = item.children.map(rollUp);
        for (const child of item.children) {
            item.limitPaise += child.limitPaise;
            item.spentPaise += child.spentPaise;
            item.remainingPaise += child.remainingPaise;
            item.projectedSpendPaise += child.projectedSpendPaise;
            item.upcomingPaise += child.upcomingPaise;
            item.rolloverPaise += child.rolloverPaise;
        }
        item.percentUsed = item.limitPaise > 0n ? Number((item.spentPaise * 10_000n) / item.limitPaise) / 100 : item.spentPaise > 0n ? 100 : 0;
        item.dailyAllowancePaise = daysLeft > 0 && item.remainingPaise > 0n ? item.remainingPaise / BigInt(daysLeft) : 0n;
        item.pace = paceFor(item.percentUsed, elapsedShare);
        return item;
    };

    const nested = roots.map(rollUp);
    const totalLimit = nested.reduce((sum, item) => sum + item.limitPaise, 0n);
    const totalSpent = nested.reduce((sum, item) => sum + item.spentPaise, 0n);
    const totalRollover = nested.reduce((sum, item) => sum + item.rolloverPaise, 0n);
    const totalRemaining = totalLimit - totalSpent;
    const percentUsed = totalLimit > 0n ? Number((totalSpent * 10_000n) / totalLimit) / 100 : totalSpent > 0n ? 100 : 0;
    const projectedSpend = nested.reduce((sum, item) => sum + item.projectedSpendPaise, 0n);
    const projectedOverspend = projectedSpend > totalLimit ? projectedSpend - totalLimit : 0n;

    return {
        id: budget.id,
        name: budget.name,
        period: budget.period as BudgetPeriod,
        type,
        rollover: budget.rollover,
        rolloverCapPaise: budget.rolloverCapPaise,
        startDate: budget.startDate,
        endDate: budget.endDate,
        periodStart: window.start,
        periodEnd: window.end,
        daysLeft,
        totalLimitPaise: totalLimit,
        totalSpentPaise: totalSpent,
        totalRemainingPaise: totalRemaining,
        percentUsed,
        rolloverPaise: totalRollover,
        incomePaise: income,
        unallocatedPaise: type === 'ZERO_BASED' ? income - totalLimit : null,
        projectedOverspendPaise: projectedOverspend,
        pace: paceFor(percentUsed, elapsedShare),
        items: nested,
    };
}

/** All active budgets with live progress, for the budgets tab. */
export async function budgetOverview(userId: string, now: Date = new Date()): Promise<BudgetStatus[]> {
    const budgets = await prisma.budget.findMany({
        where: { userId, deletedAt: null },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
    });
    const index = await accountIndex(userId);
    const statuses: BudgetStatus[] = [];
    for (const budget of budgets) statuses.push(await computeBudgetStatus(userId, budget, now, index));
    return statuses;
}

interface ThresholdCopy {
    threshold: number;
    title: string;
    body: (name: string, spent: string, limit: string) => string;
}

const THRESHOLDS: ThresholdCopy[] = [
    { threshold: 50, title: 'Half of a budget is spent', body: (name, spent, limit) => `${name}: ${spent} of ${limit} used (50%).` },
    { threshold: 80, title: 'A budget is nearly used up', body: (name, spent, limit) => `${name}: ${spent} of ${limit} used (80%).` },
    { threshold: 100, title: 'A budget is at its limit', body: (name, spent, limit) => `${name}: ${spent} of ${limit} used. New spending is over budget.` },
    { threshold: 101, title: 'A budget is over', body: (name, spent, limit) => `${name}: ${spent} against a ${limit} budget.` },
];

/**
 * Fires threshold notifications once per item, period and threshold.
 * Called after every ledger change that can move spending, so alerts are near-real-time.
 */
export async function evaluateBudgetAlerts(userId: string, now: Date = new Date()): Promise<number> {
    const budgets = await prisma.budget.findMany({ where: { userId, deletedAt: null }, include: { items: true } });
    if (budgets.length === 0) return 0;

    let sent = 0;
    const index = await accountIndex(userId);

    for (const budget of budgets) {
        const status = await computeBudgetStatus(userId, budget, now, index);
        const flat: ItemStatus[] = [];
        const walk = (items: ItemStatus[]) => items.forEach((item) => { flat.push(item); walk(item.children); });
        walk(status.items);

        for (const item of flat) {
            if (item.limitPaise <= 0n) continue;
            const crossed = new Set<number>();
            for (const threshold of item.alertAt ?? [50, 80, 100]) {
                if (item.percentUsed >= threshold) crossed.add(threshold);
            }
            if (item.spentPaise > item.limitPaise) crossed.add(101);

            for (const threshold of crossed) {
                const created = await prisma.budgetAlertLog.createMany({
                    data: [{ itemId: item.id, periodStart: status.periodStart, threshold }],
                    skipDuplicates: true,
                });
                if (created.count === 0) continue;

                const copy = THRESHOLDS.find((entry) => entry.threshold === threshold) ?? THRESHOLDS[THRESHOLDS.length - 1];
                await createNotification({
                    userId,
                    type: 'BUDGET',
                    title: copy.title,
                    body: copy.body(item.name, `₹${formatPaise(item.spentPaise)}`, `₹${formatPaise(item.limitPaise)}`),
                    href: '/?tab=budgets',
                });
                sent += 1;
            }
        }
    }

    return sent;
}

export interface SafeToSpend {
    liquidPaise: bigint;
    reservedBudgetPaise: bigint;
    upcomingBillsPaise: bigint;
    debtDuesPaise: bigint;
    safeToSpendPaise: bigint;
    horizonDays: number;
}

export async function safeToSpend(userId: string, horizonDays = 30, now: Date = new Date()): Promise<SafeToSpend> {
    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true, type: true, subType: true } });
    const liquidIds = accounts.filter((account) => account.type === 'ASSET' && ['Bank', 'Cash', 'Wallet'].includes(account.subType ?? '')).map((account) => account.id);

    const [liquidAgg, budgets, occurrences, liabilities] = await Promise.all([
        prisma.transactionSplit.aggregate({
            where: { accountId: { in: liquidIds }, transaction: { userId, status: 'COMPLETED', deletedAt: null } },
            _sum: { amount: true },
        }),
        budgetOverview(userId, now),
        prisma.recurringOccurrence.findMany({
            where: {
                rule: { userId, isActive: true },
                status: 'PENDING',
                dueDate: { gte: startOfUtcDay(now), lt: new Date(now.getTime() + horizonDays * 86_400_000) },
            },
            include: { rule: { select: { template: true } } },
        }),
        prisma.account.findMany({ where: { userId, type: 'LIABILITY' }, select: { id: true, dueDate: true } }),
    ]);

    const liquid = liquidAgg._sum.amount ?? 0n;
    const reserved = budgets.reduce((sum, budget) => sum + (budget.totalRemainingPaise > 0n ? budget.totalRemainingPaise : 0n), 0n);

    let bills = 0n;
    for (const occurrence of occurrences) {
        const template = occurrence.rule.template as unknown as { lines?: TemplateLine[] } | null;
        for (const line of template?.lines ?? []) {
            const amount = BigInt(line.amountPaise);
            if (amount < 0n) bills += -amount;
        }
    }

    // Only debts with a due date inside the horizon are reserved; a long mortgage is not cash due this month.
    const horizonEnd = new Date(now.getTime() + horizonDays * 86_400_000);
    const dueSoon = liabilities.filter((account) => account.dueDate && account.dueDate.getTime() < horizonEnd.getTime());
    let debts = 0n;
    for (const account of dueSoon) {
        const aggregate = await prisma.transactionSplit.aggregate({
            where: {
                accountId: account.id,
                transaction: { userId, status: 'COMPLETED', deletedAt: null },
            },
            _sum: { amount: true },
        });
        const owed = -(aggregate._sum.amount ?? 0n);
        if (owed > 0n) debts += owed;
    }
    return {
        liquidPaise: liquid,
        reservedBudgetPaise: reserved,
        upcomingBillsPaise: bills,
        debtDuesPaise: debts,
        safeToSpendPaise: liquid - reserved - bills - debts,
        horizonDays,
    };
}

export interface MonthlySummary {
    month: string;
    incomePaise: bigint;
    expensePaise: bigint;
    savingsPaise: bigint;
    savingsRate: number;
    previousExpensePaise: bigint;
    expenseChangePercent: number | null;
    topCategories: { name: string; accountId: number; spentPaise: bigint }[];
    unbudgeted: { name: string; accountId: number; spentPaise: bigint }[];
}

export async function monthlySummary(userId: string, now: Date = new Date()): Promise<MonthlySummary> {
    const current = windowContaining('MONTHLY', now);
    const previous = windowContaining('MONTHLY', new Date(current.start.getTime() - 86_400_000));

    const [income, expense, previousExpense] = await Promise.all([
        incomeInWindow(userId, current),
        expenseInWindow(userId, current),
        expenseInWindow(userId, previous),
    ]);

    const splits = await prisma.transactionSplit.groupBy({
        by: ['accountId'],
        where: {
            account: { userId, type: 'EXPENSE' },
            transaction: { userId, status: 'COMPLETED', deletedAt: null, date: { gte: current.start, lt: current.end } },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 20,
    });

    const accounts = await prisma.account.findMany({
        where: { userId, id: { in: splits.map((split) => split.accountId) } },
        select: { id: true, name: true },
    });
    const names = new Map(accounts.map((account) => [account.id, account.name]));

    const budgets = await budgetOverview(userId, now);
    const budgetedAccounts = new Set<number>();
    const walk = (items: BudgetStatus['items']) => items.forEach((item) => {
        if (item.accountId) budgetedAccounts.add(item.accountId);
        walk(item.children);
    });
    budgets.forEach((budget) => walk(budget.items));

    const categories = splits
        .map((split) => ({ name: names.get(split.accountId) ?? 'Unknown', accountId: split.accountId, spentPaise: split._sum.amount ?? 0n }))
        .filter((entry) => entry.spentPaise > 0n);

    const savings = income - expense;
    return {
        month: dayKey(current.start).slice(0, 7),
        incomePaise: income,
        expensePaise: expense,
        savingsPaise: savings,
        savingsRate: income > 0n ? Number((savings * 10_000n) / income) / 100 : 0,
        previousExpensePaise: previousExpense,
        expenseChangePercent: previousExpense > 0n ? Number(((expense - previousExpense) * 10_000n) / previousExpense) / 100 : null,
        topCategories: categories.slice(0, 6),
        unbudgeted: categories.filter((entry) => !budgetedAccounts.has(entry.accountId)).slice(0, 8),
    };
}

export interface BudgetTemplate {
    id: string;
    name: string;
    description: string;
    type: BudgetType;
    items: { name: string; percent: number }[];
}

/** Daily sweep: keeps alerts correct as periods roll over even when no transaction is posted. */
export async function evaluateAllBudgetAlerts(now: Date = new Date()): Promise<{ users: number; sent: number }> {
    const rows = await prisma.budget.findMany({
        where: { deletedAt: null },
        select: { userId: true },
        distinct: ['userId'],
    });
    let sent = 0;
    for (const row of rows) sent += await evaluateBudgetAlerts(row.userId, now);
    return { users: rows.length, sent };
}

export const BUDGET_TEMPLATES: BudgetTemplate[] = [    {
        id: '50-30-20',
        name: '50 / 30 / 20',
        description: 'Half to needs, a third to wants, a fifth saved.',
        type: 'PERCENT_INCOME',
        items: [
            { name: 'Needs', percent: 50 },
            { name: 'Wants', percent: 30 },
            { name: 'Savings', percent: 20 },
        ],
    },
    {
        id: 'zero-based',
        name: 'Zero-based',
        description: 'Every rupee of income gets a job before the month starts.',
        type: 'ZERO_BASED',
        items: [
            { name: 'Housing', percent: 30 },
            { name: 'Food', percent: 15 },
            { name: 'Transport', percent: 10 },
            { name: 'Bills', percent: 10 },
            { name: 'Lifestyle', percent: 15 },
            { name: 'Savings', percent: 20 },
        ],
    },
    {
        id: 'envelope',
        name: 'Envelope',
        description: 'Cash-like envelopes that carry unspent money forward.',
        type: 'ENVELOPE',
        items: [
            { name: 'Groceries', percent: 15 },
            { name: 'Eating out', percent: 10 },
            { name: 'Shopping', percent: 10 },
            { name: 'Fuel', percent: 8 },
        ],
    },
];
