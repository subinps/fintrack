import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { computeNetWorth, snapshotNetWorth } from '../services/networth';
import { enqueue, QUEUES } from '../lib/queue';

const router = express.Router();

// POST /api/networth/recompute — recompute now, persist today's snapshot, and re-queue.
router.post('/recompute', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;
        const { totals, snapshot } = (await snapshotNetWorth(userId)) ?? {};

        if (!totals || !snapshot) {
            return res.status(404).json({ error: 'User not found' });
        }

        await enqueue(QUEUES.networth, { userId }, { singletonKey: `networth:${userId}:manual` });

        res.json({
            assets: totals.assets,
            liabilities: totals.liabilities,
            netWorth: totals.netWorth,
            snapshot: {
                date: snapshot.date,
                createdAt: snapshot.createdAt,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/networth — current totals without writing a snapshot.
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await computeNetWorth(req.user!.id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
