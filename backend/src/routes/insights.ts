import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { digest, insights, search } from '../services/insights';

const router = express.Router();

router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const query = String(req.query.q ?? '').slice(0, 80);
        res.json(await search(req.user!.id, query));
    } catch (error) {
        console.error('[search]', error);
        res.status(500).json({ error: 'Search is unavailable right now.' });
    }
});

router.get('/insights', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await insights(req.user!.id));
    } catch (error) {
        console.error('[insights]', error);
        res.status(500).json({ error: 'Could not work out your insights.' });
    }
});

router.get('/insights/digest', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await digest(req.user!.id));
    } catch (error) {
        console.error('[digest]', error);
        res.status(500).json({ error: 'Could not build this month’s digest.' });
    }
});

export default router;
