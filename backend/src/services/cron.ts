import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import axios from 'axios';

// Helper to get start of day in UTC
const getStartOfDay = (date: Date) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return start;
};

async function updateMarketPrices() {
    console.log('[CRON] Updating market prices...');
    try {
        // 1. Get all unique symbols from accounts
        const accounts = await prisma.account.findMany({
            where: {
                type: 'ASSET',
                symbol: { not: null }
            },
            select: { symbol: true }
        });

        const uniqueSymbols = [...new Set(accounts.map(a => a.symbol).filter(s => s))];
        console.log(`[CRON] Found ${uniqueSymbols.length} symbols to update.`);

        // 2. Update prices
        for (const symbol of uniqueSymbols) {
            if (!symbol) continue;
            try {
                const upperSymbol = symbol.toUpperCase();

                // Check if we have a fresh price (e.g., updated in the last 15 minutes)
                const existingPrice = await prisma.marketPrice.findUnique({
                    where: { symbol: upperSymbol }
                });

                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

                if (existingPrice && existingPrice.lastUpdated > fifteenMinutesAgo) {
                    // Price is fresh, skip API call
                    continue;
                }

                const response = await axios.get(`https://tools.subinps.in/price/${upperSymbol}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinTrack/1.0)' }
                });

                const data = response.data;
                let price = null;
                if (data && typeof data.price === 'number') price = data.price;
                else if (data && typeof data.price === 'string') price = parseFloat(data.price);

                if (price !== null && !isNaN(price) && price > 0) {
                    await prisma.marketPrice.upsert({
                        where: { symbol: upperSymbol },
                        update: { price, lastUpdated: new Date() },
                        create: { symbol: upperSymbol, price, lastUpdated: new Date() }
                    });
                }
            } catch (error) {
                console.error(`[CRON] Failed to update price for ${symbol}:`, error);
            }
        }
        console.log('[CRON] Market prices updated.');
    } catch (error) {
        console.error('[CRON] Error updating market prices:', error);
    }
}

async function calculateNetWorth() {
    console.log('[CRON] Calculating net worth for all users...');
    try {
        const users = await prisma.user.findMany({ select: { id: true } });
        const today = new Date();
        const startOfToday = getStartOfDay(today);

        for (const user of users) {
            try {
                const userId = user.id;

                // Fetch accounts with splits
                const accounts = await prisma.account.findMany({
                    where: { userId },
                    include: {
                        splits: {
                            where: { transaction: { status: 'COMPLETED' } }
                        }
                    },
                });

                let totalAssets = 0;
                let totalLiabilities = 0;

                for (const account of accounts) {
                    const balanceBigInt = account.splits.reduce((sum, split) => sum + BigInt(split.amount), BigInt(0));
                    let value = Number(balanceBigInt);

                    // Market Value Logic
                    if (['ASSET'].includes(account.type) &&
                        ['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'].includes(account.subType || '') &&
                        account.units) {

                        // Fetch latest price from DB (should be fresh from previous step)
                        if (account.symbol) {
                            const priceData = await prisma.marketPrice.findUnique({
                                where: { symbol: account.symbol.toUpperCase() }
                            });
                            if (priceData) {
                                value = Number(priceData.price) * account.units * 100;
                            } else if (account.lastMarketPrice) {
                                // Fallback to account's stored last price if global price missing
                                value = Number(account.lastMarketPrice) * account.units * 100;
                            }
                        } else if (account.lastMarketPrice) {
                            value = Number(account.lastMarketPrice) * account.units * 100;
                        }
                    }

                    if (account.type === 'ASSET') {
                        totalAssets += value;
                    } else if (account.type === 'LIABILITY') {
                        totalLiabilities += Math.abs(value);
                    }
                }

                const currentNetWorth = totalAssets - totalLiabilities;

                // Create/Update Snapshot
                const existingSnapshot = await prisma.netWorthSnapshot.findFirst({
                    where: {
                        userId,
                        date: {
                            gte: startOfToday,
                            lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000),
                        },
                    },
                });

                if (existingSnapshot) {
                    await prisma.netWorthSnapshot.update({
                        where: { id: existingSnapshot.id },
                        data: {
                            netWorth: currentNetWorth,
                            assets: totalAssets,
                            liabilities: totalLiabilities,
                        },
                    });
                } else {
                    await prisma.netWorthSnapshot.create({
                        data: {
                            userId,
                            date: startOfToday,
                            netWorth: currentNetWorth,
                            assets: totalAssets,
                            liabilities: totalLiabilities,
                        },
                    });
                }

            } catch (err) {
                console.error(`[CRON] Error calculating net worth for user ${user.id}:`, err);
            }
        }
        console.log('[CRON] Net worth calculation completed.');
    } catch (error) {
        console.error('[CRON] Error in net worth job:', error);
    }
}

export function initCronJobs() {
    // Schedule task to run at 23:59 every day
    cron.schedule('59 23 * * *', async () => {
        console.log('[CRON] Starting daily scheduled tasks...');
        await updateMarketPrices();
        await calculateNetWorth();
        console.log('[CRON] Daily tasks finished.');
    });

    console.log('Cron jobs initialized: Net Worth Calculation scheduled for 23:59 daily.');
}
