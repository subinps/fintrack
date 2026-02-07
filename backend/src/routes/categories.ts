import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all categories
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const categories = await prisma.category.findMany({
            where: { userId: req.user?.id },
            orderBy: { name: 'asc' },
        });
        res.json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create category
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { name, type } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'Name and Type are required' });
        }

        const category = await prisma.category.create({
            data: {
                name,
                type,
                userId: req.user!.id,
            },
        });
        res.json(category);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete category
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await prisma.category.delete({
            where: { id: parseInt(id), userId: req.user!.id },
        });
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
