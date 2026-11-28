import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getProfile, taxSummary } from '../services/tax';

const router = express.Router();

const profileSchema = z.object({
    fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
    regime: z.enum(['new', 'old']).optional(),
    deductions: z
        .array(
            z.object({
                label: z.string().min(1).max(60),
                tag: z.string().min(1).max(40),
                limitPaise: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
            })
        )
        .max(12)
        .optional(),
    notes: z.string().max(2000).nullish(),
});

router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
    const profile = await getProfile(req.user!.id);
    res.json(profile);
});

router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the tax settings.', details: parsed.error.flatten() });
    await getProfile(req.user!.id);
    const profile = await prisma.taxProfile.update({
        where: { userId: req.user!.id },
        data: {
            ...(parsed.data.fiscalYearStartMonth ? { fiscalYearStartMonth: parsed.data.fiscalYearStartMonth } : {}),
            ...(parsed.data.regime ? { regime: parsed.data.regime } : {}),
            ...(parsed.data.deductions ? { deductions: parsed.data.deductions } : {}),
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes ?? null } : {}),
        },
    });
    res.json(profile);
});

router.get('/summary', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await taxSummary(req.user!.id));
    } catch (error) {
        console.error('[tax]', error);
        res.status(500).json({ error: 'Could not build the tax summary.' });
    }
});

export default router;
