import { prisma } from '../lib/prisma';
import { formatPaise, rupeesToPaise } from '../lib/money';

/** Phase 7: investment analytics over the existing Account/TransactionSplit data. */

export interface Holding {
    accountId: number;
    name: string;
    symbol: string | null;
    units: number;
    averageCost: string;
    invested: string;
    lastPrice: string;
    marketValue: string;
    unrealised: string;
    unrealisedPercent: number | null;
    realised: string;
    weightPercent: number;
    firstBuy: string | null;
    xirrPercent: number | null;
}

export interface InvestmentAnalytics {
    generatedAt: string;
    holdings: Holding[];
    totals: { invested: string; marketValue: string; unrealised: string; realised: string; xirrPercent: number | null };
    allocation: { name: string; value: string; weightPercent: number }[];
    concentration: { name: string; weightPercent: number }[];
    empty: boolean;
}

interface Flow {
    date: Date;
    amount: number;
}

/** XIRR via bisection: robust, no derivative blow-ups on weird cash flow sets. */
export function xirr(flows: Flow[]): number | null {
    if (flows.length < 2) return null;
    const hasNegative = flows.some((flow) => flow.amount < 0);
    const hasPositive = flows.some((flow) => flow.amount > 0);
    if (!hasNegative || !hasPositive) return null;
    const start = flows.reduce((earliest, flow) => (flow.date < earliest ? flow.date : earliest), flows[0].date);
    const npv = (rate: number): number => {
        let total = 0;
        for (const flow of flows) {
            const years = (flow.date.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
            total += flow.amount / Math.pow(1 + rate, years);
        }
        return total;
    };
    let low = -0.9999;
    let high = 10;
    let lowValue = npv(low);
    let highValue = npv(high);
    if (Number.isNaN(lowValue) || Number.isNaN(highValue) || lowValue * highValue > 0) {
        // Widen once before giving up.
        high = 100;
        highValue = npv(high);
        if (Number.isNaN(highValue) || lowValue * highValue > 0) return null;
    }
    for (let i = 0; i < 200; i += 1) {
        const mid = (low + high) / 2;
        const value = npv(mid);
        if (Math.abs(value) < 1e-7) return Math.round(mid * 10000) / 100;
        if (Number.isNaN(value)) return null;
        if (lowValue * value <= 0) {
            high = mid;
            highValue = value;
        } else {
            low = mid;
            lowValue = value;
        }
    }
    return Math.round(((low + high) / 2) * 10000) / 100;
}

export async function investmentAnalytics(userId: string, asOf = new Date()): Promise<InvestmentAnalytics> {
    const accounts = await prisma.account.findMany({
        where: { userId, type: 'ASSET', units: { not: null } },
        select: { id: true, name: true, symbol: true, units: true, lastMarketPrice: true },
        orderBy: { name: 'asc' },
    });

    if (accounts.length === 0) {
        return {
            generatedAt: asOf.toISOString(),
            holdings: [],
            totals: { invested: '0', marketValue: '0', unrealised: '0', realised: '0', xirrPercent: null },
            allocation: [],
            concentration: [],
            empty: true,
        };
    }

    const legs = await prisma.transactionSplit.findMany({
        where: { accountId: { in: accounts.map((account) => account.id) }, transaction: { userId, status: { not: 'VOIDED' } } },
        include: { transaction: { select: { date: true } } },
        orderBy: { transaction: { date: 'asc' } },
    });

    const holdings: Holding[] = [];
    let totalInvested = 0n;
    let totalValue = 0n;
    let totalRealised = 0n;
    const allFlows: Flow[] = [];

    for (const account of accounts) {
        const accountLegs = legs.filter((leg) => leg.accountId === account.id);
        let units = 0;
        let invested = 0n;
        let realised = 0n;
        let firstBuy: Date | null = null;
        const flows: Flow[] = [];
        for (const leg of accountLegs) {
            const unitsDelta = Number(leg.units ?? 0);
            if (unitsDelta > 0) {
                units += unitsDelta;
                invested += -leg.amount;
                if (!firstBuy) firstBuy = leg.transaction.date;
            } else if (unitsDelta < 0) {
                const averageCost = units > 0 ? Number(invested) / units : 0;
                realised += leg.amount + BigInt(Math.round(unitsDelta * averageCost));
                units += unitsDelta;
                invested = BigInt(Math.round(Number(invested) + unitsDelta * averageCost));
            }
            // Investor cash flow: buying is negative, selling positive.
            flows.push({ date: leg.transaction.date, amount: -Number(leg.amount) / 100 });
        }
        if (accountLegs.length === 0) {
            const opening = Number(account.units ?? 0);
            if (opening > 0 && account.lastMarketPrice) {
                units = opening;
                invested = BigInt(Math.round(opening * Number(account.lastMarketPrice) * 100));
            }
        }
        if (Math.abs(units) < 1e-9 && invested === 0n) {
            // Fully exited holding: keep the realised amount only.
            if (realised === 0n) continue;
        }

        const lastPrice = account.lastMarketPrice ? Number(account.lastMarketPrice) : (units > 0 ? Number(invested) / units : 0);
        const marketPaise = BigInt(Math.round(units * lastPrice * 100));
        const unrealised = marketPaise - invested;
        const costPerUnit = units > 0 ? Number(invested) / units / 100 : 0;

        flows.push({ date: asOf, amount: Number(marketPaise) / 100 });
        const rate = xirr(flows);
        if (rate !== null) allFlows.push(...flows);

        totalInvested += invested;
        totalValue += marketPaise;
        totalRealised += realised;

        holdings.push({
            accountId: account.id,
            name: account.name,
            symbol: account.symbol,
            units: Math.round(units * 1e6) / 1e6,
            averageCost: costPerUnit.toFixed(2),
            invested: formatPaise(invested),
            lastPrice: lastPrice.toFixed(2),
            marketValue: formatPaise(marketPaise),
            unrealised: formatPaise(unrealised),
            unrealisedPercent: invested > 0n ? Math.round((Number(unrealised) / Number(invested)) * 10000) / 100 : null,
            realised: formatPaise(realised),
            weightPercent: 0,
            firstBuy: firstBuy ? firstBuy.toISOString().slice(0, 10) : null,
            xirrPercent: rate,
        });
    }

    for (const holding of holdings) {
        const value = rupeesToPaise(holding.marketValue);
        holding.weightPercent = totalValue > 0n ? Math.round((Number(value) / Number(totalValue)) * 10000) / 100 : 0;
    }

    const totalXirr = allFlows.length > 1 ? xirr(allFlows) : null;

    return {
        generatedAt: asOf.toISOString(),
        holdings: holdings.sort((a, b) => Number(b.marketValue) - Number(a.marketValue)),
        totals: {
            invested: formatPaise(totalInvested),
            marketValue: formatPaise(totalValue),
            unrealised: formatPaise(totalValue - totalInvested),
            realised: formatPaise(totalRealised),
            xirrPercent: totalXirr,
        },
        allocation: holdings.map((holding) => ({ name: holding.name, value: holding.marketValue, weightPercent: holding.weightPercent })),
        concentration: holdings.filter((holding) => holding.weightPercent >= 25).map((holding) => ({ name: holding.name, weightPercent: holding.weightPercent })),
        empty: holdings.length === 0,
    };
}
