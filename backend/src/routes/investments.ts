import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { investmentAnalytics } from '../services/investments';

const router = express.Router();

router.get('/analytics', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await investmentAnalytics(req.user!.id));
    } catch (error) {
        console.error('[investments]', error);
        res.status(500).json({ error: 'Could not build the portfolio analytics.' });
    }
});

const priceSchema = z.object({ price: z.number().positive().max(10_000_000) });

router.post('/:accountId/price', authenticateToken, async (req: AuthRequest, res) => {
    const parsed = priceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a price greater than zero.' });
    const accountId = Number.parseInt(req.params.accountId, 10);
    const account = await prisma.account.findFirst({ where: { id: accountId, userId: req.user!.id }, select: { id: true } });
    if (!account) return res.status(404).json({ error: 'Holding not found.' });
    const updated = await prisma.account.update({
        where: { id: accountId },
        data: { lastMarketPrice: parsed.data.price, lastMarketUpdate: new Date() },
        select: { id: true, name: true, lastMarketPrice: true, lastMarketUpdate: true },
    });
    res.json(updated);
});

export default router;
