import { prisma } from '../lib/prisma';
import { formatPaise } from '../lib/money';

/** Phase 9: loans and credit cards, derived from liability balances plus the terms on the account. */

export interface ScheduleRow {
    month: number;
    dueDate: string;
    emi: string;
    interest: string;
    principal: string;
    balance: string;
}

export interface LoanSummary {
    accountId: number;
    name: string;
    subType: string | null;
    outstanding: string;
    principal: string;
    interestRate: number | null;
    tenureMonths: number | null;
    emi: string;
    monthsPaid: number | null;
    monthsRemaining: number | null;
    interestRemaining: string | null;
    payoffDate: string | null;
    nextDue: string | null;
    daysToDue: number | null;
    progressPercent: number;
    schedule: ScheduleRow[];
}

export interface CardSummary {
    accountId: number;
    name: string;
    outstanding: string;
    creditLimit: string | null;
    utilisationPercent: number | null;
    available: string | null;
    dueDay: number | null;
    statementDay: number | null;
    nextDue: string | null;
    daysToDue: number | null;
    minimumDue: string | null;
    health: 'low' | 'medium' | 'high' | 'unknown';
}

const monthlyAmount = (principalPaise: bigint, annualRatePercent: number, months: number): bigint => {
    const r = annualRatePercent / 100 / 12;
    if (r === 0) return principalPaise / BigInt(months);
    const factor = Math.pow(1 + r, months);
    const emi = (Number(principalPaise) * r * factor) / (factor - 1);
    return BigInt(Math.round(emi));
};

export interface RawScheduleRow {
    month: number;
    dueDate: string;
    emiPaise: bigint;
    interestPaise: bigint;
    principalPaise: bigint;
    balancePaise: bigint;
}

export function amortiseRaw(principalPaise: bigint, annualRatePercent: number, months: number, limit = 240, extraPaise = 0n): RawScheduleRow[] {
    const rows: RawScheduleRow[] = [];
    let balance = principalPaise;
    const emi = monthlyAmount(principalPaise, annualRatePercent, months);
    const r = annualRatePercent / 100 / 12;
    const today = new Date();
    for (let month = 1; month <= Math.min(months, limit) && balance > 0n; month += 1) {
        const interest = BigInt(Math.round(Number(balance) * r));
        let principalPaid = emi - interest + (extraPaise > 0n ? extraPaise : 0n);
        if (principalPaid > balance) principalPaid = balance;
        if (principalPaid < 0n) principalPaid = 0n;
        balance -= principalPaid;
        const due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + month, 1));
        rows.push({
            month,
            dueDate: due.toISOString().slice(0, 10),
            emiPaise: principalPaid + interest,
            interestPaise: interest,
            principalPaise: principalPaid,
            balancePaise: balance,
        });
    }
    return rows;
}

export function amortise(principalPaise: bigint, annualRatePercent: number, months: number, limit = 240, extraPaise = 0n): ScheduleRow[] {
    return amortiseRaw(principalPaise, annualRatePercent, months, limit, extraPaise).map((row) => ({
        month: row.month,
        dueDate: row.dueDate,
        emi: formatPaise(row.emiPaise),
        interest: formatPaise(row.interestPaise),
        principal: formatPaise(row.principalPaise),
        balance: formatPaise(row.balancePaise),
    }));
}

const nextDueDate = (day: number): { due: string; days: number } => {
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    const due = thisMonth.getTime() >= now.getTime() ? thisMonth : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
    const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
    return { due: due.toISOString().slice(0, 10), days };
};

export async function loanSummaries(userId: string): Promise<LoanSummary[]> {
    const accounts = await prisma.account.findMany({
        where: { userId, type: 'LIABILITY' },
        orderBy: { name: 'asc' },
    });
    const splits = await prisma.transactionSplit.findMany({
        where: { account: { userId, type: 'LIABILITY' }, transaction: { userId, status: { not: 'VOIDED' } } },
        select: { accountId: true, amount: true },
    });

    return accounts.map((account) => {
        const balancePaise = splits.filter((split) => split.accountId === account.id).reduce((sum, split) => sum + split.amount, 0n);
        // Liability balances are negative credits; outstanding is the positive amount owed.
        const outstanding = balancePaise < 0n ? -balancePaise : balancePaise;
        const principal = account.loanPrincipalPaise ?? outstanding;
        const rate = account.interestRate ?? null;
        const tenure = account.tenureMonths ?? null;
        const emi = account.emiPaise ?? (rate !== null && tenure ? monthlyAmount(principal, rate, tenure) : 0n);
        const monthsPaid = emi > 0n && tenure ? Math.max(0, Math.min(tenure, Math.round(Number(principal - outstanding) / Number(emi)))) : null;

        let schedule: ScheduleRow[] = [];
        let interestRemaining: string | null = null;
        let payoffDate: string | null = null;
        if (rate !== null && tenure && outstanding > 0n) {
            const remainingMonths = emi > 0n ? Math.max(1, Math.ceil(Number(outstanding) / Number(emi))) : tenure;
            schedule = amortise(outstanding, rate, remainingMonths, 24);
            const full = amortise(outstanding, rate, remainingMonths, 600);
            const interest = full.reduce((sum, row) => sum + BigInt(Math.round(Number(row.interest) * 100)), 0n);
            interestRemaining = formatPaise(interest);
            const last = full[full.length - 1];
            payoffDate = last?.dueDate ?? null;
        }

        const dueDay = account.dueDay ?? (account.dueDate ? account.dueDate.getUTCDate() : null);
        const next = dueDay ? nextDueDate(dueDay) : null;

        return {
            accountId: account.id,
            name: account.name,
            subType: account.subType,
            outstanding: formatPaise(outstanding),
            principal: formatPaise(principal),
            interestRate: rate,
            tenureMonths: tenure,
            emi: formatPaise(emi),
            monthsPaid,
            monthsRemaining: schedule.length > 0 ? Math.max(1, Math.ceil(Number(outstanding) / Number(emi || 1n))) : null,
            interestRemaining,
            payoffDate,
            nextDue: next?.due ?? null,
            daysToDue: next?.days ?? null,
            progressPercent: principal > 0n ? Math.min(100, Math.round((Number(principal - outstanding) / Number(principal)) * 1000) / 10) : 0,
            schedule,
        };
    });
}

export async function cardSummaries(userId: string): Promise<CardSummary[]> {
    const accounts = await prisma.account.findMany({
        where: { userId, type: 'LIABILITY', subType: { in: ['Credit Card', 'CREDIT_CARD', 'Credit card'] } },
        orderBy: { name: 'asc' },
    });
    if (accounts.length === 0) return [];
    const splits = await prisma.transactionSplit.findMany({
        where: { accountId: { in: accounts.map((account) => account.id) }, transaction: { userId, status: { not: 'VOIDED' } } },
        select: { accountId: true, amount: true },
    });

    return accounts.map((account) => {
        const balance = splits.filter((split) => split.accountId === account.id).reduce((sum, split) => sum + split.amount, 0n);
        const outstanding = balance < 0n ? -balance : balance;
        const limit = account.creditLimitPaise ?? null;
        const utilisation = limit && limit > 0n ? Math.round((Number(outstanding) / Number(limit)) * 1000) / 10 : null;
        const dueDay = account.dueDay ?? (account.dueDate ? account.dueDate.getUTCDate() : null);
        const next = dueDay ? nextDueDate(dueDay) : null;
        const fivePercent = (outstanding * 5n) / 100n;
        const floor = 500_00n;
        const minimum = outstanding === 0n ? 0n : fivePercent > floor ? fivePercent : floor < outstanding ? floor : outstanding;
        return {
            accountId: account.id,
            name: account.name,
            outstanding: formatPaise(outstanding),
            creditLimit: limit ? formatPaise(limit) : null,
            utilisationPercent: utilisation,
            available: limit ? formatPaise(limit - outstanding) : null,
            dueDay,
            statementDay: account.statementDay,
            nextDue: next?.due ?? null,
            daysToDue: next?.days ?? null,
            minimumDue: formatPaise(minimum),
            health: utilisation === null ? 'unknown' : utilisation >= 70 ? 'high' : utilisation >= 30 ? 'medium' : 'low',
        };
    });
}
