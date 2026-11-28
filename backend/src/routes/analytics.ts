import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { snapshotNetWorth } from '../services/networth';

const router = Router();

router.get('/net-worth-history', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;

        // Today's snapshot is recomputed and upserted, then the full series is returned.
        await snapshotNetWorth(userId);

        const history = await prisma.netWorthSnapshot.findMany({
            where: { userId },
            orderBy: { date: 'asc' },
        });

        // Convert Decimal to Number for the JSON response
        res.json(history.map(record => ({
            date: record.date,
            netWorth: Number(record.netWorth),
            assets: Number(record.assets),
            liabilities: Number(record.liabilities),
        })));
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
