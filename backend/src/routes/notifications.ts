import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { listNotifications, markRead } from '../services/notifications';
import { prisma } from '../lib/prisma';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        res.json(await listNotifications(req.user!.id, limit));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/unread-count', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const unread = await prisma.notification.count({ where: { userId: req.user!.id, readAt: null } });
        res.json({ unread });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/read', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const updated = await markRead(req.user!.id);
        res.json({ updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/:id/read', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'Invalid notification id' });
        }
        const updated = await markRead(req.user!.id, id);
        res.json({ updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
