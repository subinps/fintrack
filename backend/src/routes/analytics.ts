import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to get start of day in UTC
const getStartOfDay = (date: Date) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return start;
};

router.get('/net-worth-history', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;
        const today = new Date();
        const startOfToday = getStartOfDay(today);

        // 1. Calculate Current Net Worth
        const accounts = await prisma.account.findMany({
            where: { userId },
            include: {
                splits: {
                    where: {
                        transaction: { status: 'COMPLETED' }
                    }
                }
            },
        });

        let totalAssets = 0;
        let totalLiabilities = 0;

        for (const account of accounts) {
            // Calculate balance from splits
            const balanceBigInt = account.splits.reduce((sum, split) => sum + BigInt(split.amount), BigInt(0));
            let value = Number(balanceBigInt); // Default to balance (cents)

            // If it's an investment with a market price, use that
            if (['ASSET'].includes(account.type) &&
                ['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'].includes(account.subType || '') &&
                account.units) {

                // Priority: 1. Stored Market Price, 2. Balance (Cost Basis)
                if (account.lastMarketPrice) {
                    value = Number(account.lastMarketPrice) * account.units * 100;
                }
            }

            if (account.type === 'ASSET') {
                totalAssets += value;
            } else if (account.type === 'LIABILITY') {
                totalLiabilities += Math.abs(value); // Liabilities are stored as negative or positive, treat magnitude as debt
            }
        }

        const currentNetWorth = totalAssets - totalLiabilities;

        // 2. Check if snapshot exists for today
        const existingSnapshot = await prisma.netWorthSnapshot.findFirst({
            where: {
                userId,
                date: {
                    gte: startOfToday,
                    lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000),
                },
            },
        });

        // 3. Create/Update Snapshot
        if (existingSnapshot) {
            // Optional: Update existing snapshot with latest value for today
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

        // 4. Fetch History
        const history = await prisma.netWorthSnapshot.findMany({
            where: { userId },
            orderBy: { date: 'asc' },
        });

        // Convert Decimal to Number for JSON response
        const formattedHistory = history.map(record => ({
            date: record.date,
            netWorth: Number(record.netWorth),
            assets: Number(record.assets),
            liabilities: Number(record.liabilities),
        }));

        res.json(formattedHistory);

    } catch (error) {
        console.error('Error fetching net worth history:', error);
        res.status(500).json({ error: 'Failed to fetch net worth history' });
    }
});

router.get('/balance-history/:accountId', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { accountId } = req.params;
        const { period = 'day' } = req.query; // 'day' or 'month'
        const userId = req.user!.id;

        // Verify account ownership
        const account = await prisma.account.findFirst({
            where: { id: parseInt(accountId), userId }
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Fetch all splits ordered by date
        const splits = await prisma.transactionSplit.findMany({
            where: {
                accountId: parseInt(accountId),
                transaction: { status: 'COMPLETED' }
            },
            include: { transaction: true },
            orderBy: { transaction: { date: 'asc' } }
        });

        let runningBalance = BigInt(0);
        const history = new Map<string, number>();

        // Calculate running balance and store based on period
        splits.forEach(split => {
            runningBalance += BigInt(split.amount);
            const date = new Date(split.transaction.date);

            let key = '';
            if (period === 'month') {
                // YYYY-MM
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else {
                // YYYY-MM-DD
                key = date.toISOString().split('T')[0];
            }

            // Store/Overwrite balance for this key (so we get the closing balance of the period)
            history.set(key, Number(runningBalance));
        });

        // Convert to array
        const result = Array.from(history).map(([date, balance]) => ({ date, balance }));

        // If month view, we might want to ensure we have a point for every month since start?
        // For now, let's return the points where activity happened. 
        // Ideally, we should fill gaps, but let's see how it looks first.

        res.json(result);

    } catch (error) {
        console.error('Error fetching balance history:', error);
        res.status(500).json({ error: 'Failed to fetch balance history' });
    }
});

export default router;
