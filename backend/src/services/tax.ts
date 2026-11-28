import { prisma } from '../lib/prisma';
import { formatPaise, rupeesToPaise } from '../lib/money';
import { cashAccounts } from './reporting';

/** Phase 6: tax workspace. Figures are estimates for planning, not filing advice. */

const NEW_REGIME_SLABS: { upto: bigint | null; rate: number }[] = [
    { upto: 400_000_00n, rate: 0 },
    { upto: 800_000_00n, rate: 5 },
    { upto: 1_200_000_00n, rate: 10 },
    { upto: 1_600_000_00n, rate: 15 },
    { upto: 2_000_000_00n, rate: 20 },
    { upto: 2_400_000_00n, rate: 25 },
    { upto: null, rate: 30 },
];

const STANDARD_DEDUCTION = 75_000_00n;

const slabTax = (income: bigint): bigint => {
    let remaining = income;
    let previous = 0n;
    let tax = 0n;
    for (const slab of NEW_REGIME_SLABS) {
        if (remaining <= 0n) break;
        const width = slab.upto === null ? remaining : slab.upto - previous;
        const slice = remaining < width ? remaining : width;
        tax += (slice * BigInt(slab.rate)) / 100n;
        remaining -= slice;
        if (slab.upto !== null) previous = slab.upto;
    }
    return tax;
};

export interface DeductionInput {
    label: string;
    tag: string;
    limitPaise: string;
}

export interface TaxSummary {
    fiscalYear: { label: string; from: string; to: string };
    profile: { regime: string; fiscalYearStartMonth: number; deductions: DeductionInput[]; notes: string | null };
    income: { name: string; amount: string }[];
    totalIncome: string;
    totalExpenses: string;
    deductions: { label: string; tag: string; limit: string; used: string; remaining: string; over: boolean }[];
    capitalGains: { proceeds: string; estimatedCost: string; estimatedGain: string; note: string };
    standardDeduction: string;
    estimatedTaxableIncome: string;
    estimatedTax: string;
    effectiveRatePercent: number | null;
    advanceTax: { due: string; label: string; cumulativePercent: number; amount: string; paidSoFar: string }[];
    disclaimer: string;
}

const fiscalRange = (startMonth: number, today = new Date()) => {
    const year = today.getUTCMonth() + 1 >= startMonth ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
    const from = new Date(Date.UTC(year, startMonth - 1, 1));
    const to = new Date(Date.UTC(year + 1, startMonth - 1, 0, 23, 59, 59));
    const label = startMonth === 4 ? `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}` : `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`;
    return { from, to, label };
};

export async function getProfile(userId: string) {
    const existing = await prisma.taxProfile.findUnique({ where: { userId } });
    if (existing) return existing;
    return prisma.taxProfile.create({ data: { userId } });
}

export async function taxSummary(userId: string): Promise<TaxSummary> {
    const profile = await getProfile(userId);
    const { from, to, label } = fiscalRange(profile.fiscalYearStartMonth);
    const deductions = (Array.isArray(profile.deductions) ? profile.deductions : []) as unknown as DeductionInput[];

    const splits = await prisma.transactionSplit.findMany({
        where: { transaction: { userId, status: { not: 'VOIDED' }, date: { gte: from, lte: to } } },
        select: { amount: true, account: { select: { name: true, type: true } }, transaction: { select: { tags: true, description: true } } },
    });

    const incomeMap = new Map<string, bigint>();
    let totalIncome = 0n;
    let totalExpenses = 0n;
    const tagTotals = new Map<string, bigint>();
    for (const split of splits) {
        if (split.account.type === 'INCOME') {
            const amount = -split.amount;
            incomeMap.set(split.account.name, (incomeMap.get(split.account.name) ?? 0n) + amount);
            totalIncome += amount;
        } else if (split.account.type === 'EXPENSE') {
            totalExpenses += split.amount;
            for (const tag of split.transaction.tags) {
                const key = tag.toLowerCase();
                tagTotals.set(key, (tagTotals.get(key) ?? 0n) + split.amount);
            }
        }
    }

    const deductionRows = deductions.map((deduction) => {
        const used = tagTotals.get(deduction.tag.toLowerCase()) ?? 0n;
        const limit = deduction.limitPaise ? rupeesToPaise(deduction.limitPaise) : 0n;
        const cappedUsed = limit > 0n && used > limit ? limit : used;
        return {
            label: deduction.label,
            tag: deduction.tag,
            limit: formatPaise(limit),
            used: formatPaise(cappedUsed),
            remaining: formatPaise(limit > 0n ? limit - cappedUsed : 0n),
            over: limit > 0n && used > limit,
        };
    });

    // Estimated capital gains: sales on unit-based accounts priced at the average unit cost.
    const investments = await prisma.account.findMany({
        where: { userId, type: 'ASSET', units: { not: null } },
        select: { id: true, units: true },
    });
    let proceeds = 0n;
    let cost = 0n;
    if (investments.length > 0) {
        const ids = investments.map((account) => account.id);
        const legs = await prisma.transactionSplit.findMany({
            where: { accountId: { in: ids }, transaction: { userId, status: { not: 'VOIDED' } } },
            select: { accountId: true, amount: true, units: true },
        });
        for (const account of investments) {
            const accountLegs = legs.filter((leg) => leg.accountId === account.id);
            let units = 0;
            let invested = 0n;
            for (const leg of accountLegs) {
                const unitsDelta = Number(leg.units ?? 0);
                if (unitsDelta > 0) {
                    units += unitsDelta;
                    invested += leg.amount < 0n ? -leg.amount : leg.amount;
                }
            }
            const averageCost = units > 0 ? Number(invested) / units : 0;
            const fyLegs = await prisma.transactionSplit.findMany({
                where: { accountId: account.id, transaction: { userId, status: { not: 'VOIDED' }, date: { gte: from, lte: to } } },
                select: { amount: true, units: true },
            });
            for (const leg of fyLegs) {
                const unitsDelta = Number(leg.units ?? 0);
                if (unitsDelta < 0) {
                    proceeds += -leg.amount;
                    cost += BigInt(Math.round(Math.abs(unitsDelta) * averageCost));
                }
            }
        }
    }

    const totalDeductions = deductionRows.reduce((sum, row) => sum + rupeesToPaise(row.used), 0n);
    const exemptIncome = profile.regime === 'new' ? STANDARD_DEDUCTION : STANDARD_DEDUCTION + totalDeductions;
    const taxable = totalIncome > exemptIncome ? totalIncome - exemptIncome : 0n;
    const tax = slabTax(taxable);
    const cess = (tax * 4n) / 100n;
    const totalTax = tax + cess;

    const quarters = [
        { due: `${from.getUTCFullYear()}-06-15`, label: 'Q1 advance tax', cumulativePercent: 15 },
        { due: `${from.getUTCFullYear()}-09-15`, label: 'Q2 advance tax', cumulativePercent: 45 },
        { due: `${from.getUTCFullYear()}-12-15`, label: 'Q3 advance tax', cumulativePercent: 75 },
        { due: `${to.getUTCFullYear()}-03-15`, label: 'Q4 advance tax', cumulativePercent: 100 },
    ];

    let previousCumulative = 0n;
    const advanceTax = quarters.map((quarter) => {
        const cumulative = (totalTax * BigInt(quarter.cumulativePercent)) / 100n;
        const amount = cumulative - previousCumulative;
        previousCumulative = cumulative;
        return { ...quarter, amount: formatPaise(amount), paidSoFar: '0' };
    });

    return {
        fiscalYear: { label, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        profile: { regime: profile.regime, fiscalYearStartMonth: profile.fiscalYearStartMonth, deductions, notes: profile.notes },
        income: [...incomeMap.entries()]
            .map(([name, amount]) => ({ name, amount: formatPaise(amount) }))
            .sort((a, b) => Number(b.amount) - Number(a.amount)),
        totalIncome: formatPaise(totalIncome),
        totalExpenses: formatPaise(totalExpenses),
        deductions: deductionRows,
        capitalGains: {
            proceeds: formatPaise(proceeds),
            estimatedCost: formatPaise(cost),
            estimatedGain: formatPaise(proceeds - cost),
            note: 'Estimated from sale proceeds against average unit cost, not a lot-wise statement.',
        },
        standardDeduction: formatPaise(STANDARD_DEDUCTION),
        estimatedTaxableIncome: formatPaise(taxable),
        estimatedTax: formatPaise(totalTax),
        effectiveRatePercent: totalIncome === 0n ? null : Math.round(Number((totalTax * 10000n) / totalIncome)) / 100,
        advanceTax,
        disclaimer: 'Planning estimate only. Confirm slabs, exemptions and capital gains with your CA before filing.',
    };
}

export async function saveCashPosition(userId: string) {
    const ids = await cashAccounts(userId);
    const splits = await prisma.transactionSplit.findMany({ where: { accountId: { in: ids } }, select: { amount: true } });
    return formatPaise(splits.reduce((sum, split) => sum + split.amount, 0n));
}
