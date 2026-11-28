import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { CATEGORY_TYPES, DEFAULT_CATEGORIES } from '../lib/default-categories';

const router = express.Router();

const isKnownType = (type: string) => CATEGORY_TYPES.includes(type);

/** Seed the default categories once per user; later renames/deletes are respected. */
async function seedDefaultsOnce(userId: string) {
    const claimed = await prisma.user.updateMany({
        where: { id: userId, categoriesSeeded: false },
        data: { categoriesSeeded: true },
    });
    if (claimed.count === 0) return;

    const rows = CATEGORY_TYPES.flatMap((type) =>
        DEFAULT_CATEGORIES[type].map((name) => ({ userId, type, name }))
    );
    await prisma.category.createMany({ data: rows, skipDuplicates: true });
}

// Get all categories (defaults included)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        await seedDefaultsOnce(req.user!.id);
        const categories = await prisma.category.findMany({
            where: { userId: req.user?.id },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
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
        if (!isKnownType(type)) {
            return res.status(400).json({ error: `Type must be one of ${CATEGORY_TYPES.join(', ')}` });
        }

        const category = await prisma.category.create({
            data: {
                name: String(name).trim(),
                type,
                userId: req.user!.id,
            },
        });
        res.json(category);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'That category already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit category: rename and/or change type. Accounts using the old name follow the rename.
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, type } = req.body;
        const userId = req.user!.id;

        const existing = await prisma.category.findFirst({ where: { id, userId } });
        if (!existing) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const nextName = name === undefined ? existing.name : String(name).trim();
        const nextType = type === undefined ? existing.type : String(type);
        if (!nextName) {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (!isKnownType(nextType)) {
            return res.status(400).json({ error: `Type must be one of ${CATEGORY_TYPES.join(', ')}` });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const category = await tx.category.update({
                where: { id },
                data: { name: nextName, type: nextType },
            });

            // Keep accounts (and the pickers built from them) in step with the rename.
            if (nextName !== existing.name) {
                await tx.account.updateMany({
                    where: { userId, type: existing.type, subType: existing.name },
                    data: { subType: nextName, ...(nextType !== existing.type ? { type: nextType } : {}) },
                });
            } else if (nextType !== existing.type) {
                await tx.account.updateMany({
                    where: { userId, type: existing.type, subType: existing.name },
                    data: { type: nextType },
                });
            }

            return category;
        });

        res.json(updated);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'A category with that name already exists for this type' });
        }
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
