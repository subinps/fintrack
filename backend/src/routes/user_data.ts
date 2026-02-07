import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Export User Data (JSON)
router.get('/export', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;

        // Fetch all data
        const [accounts, categories, transactions] = await Promise.all([
            prisma.account.findMany({ where: { userId } }),
            prisma.category.findMany({ where: { userId } }),
            prisma.transaction.findMany({
                where: { userId },
                include: { splits: true }
            })
        ]);

        const exportData = {
            version: 1,
            exportedAt: new Date(),
            accounts,
            categories,
            transactions
        };

        res.setHeader('Content-Disposition', `attachment; filename="fintrack_backup_${new Date().toISOString().split('T')[0]}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(exportData, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value // return everything else unchanged
            , 2));

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Import User Data (JSON)
router.post('/import', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileContent = req.file.buffer.toString('utf-8');
        let data;
        try {
            data = JSON.parse(fileContent);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON file' });
        }

        if (!data.accounts || !data.transactions) {
            return res.status(400).json({ error: 'Invalid backup format' });
        }

        // Transactional Import
        await prisma.$transaction(async (tx) => {
            const accountIdMap = new Map<number, number>();
            const categoryIdMap = new Map<number, number>();

            // 1. Import Categories
            if (data.categories) {
                for (const cat of data.categories) {
                    // Try to find existing category by name/type to avoid duplicates
                    let category = await tx.category.findFirst({
                        where: {
                            userId,
                            name: cat.name,
                            type: cat.type
                        }
                    });

                    if (!category) {
                        category = await tx.category.create({
                            data: {
                                name: cat.name,
                                type: cat.type,
                                userId
                            }
                        });
                    }
                    categoryIdMap.set(cat.id, category.id);
                }
            }

            // 2. Import Accounts
            for (const acc of data.accounts) {
                const newAccount = await tx.account.create({
                    data: {
                        name: acc.name,
                        type: acc.type,
                        subType: acc.subType,
                        interestRate: acc.interestRate,
                        dueDate: acc.dueDate ? new Date(acc.dueDate) : null,
                        symbol: acc.symbol,
                        units: acc.units,
                        lastMarketPrice: acc.lastMarketPrice,
                        userId
                    }
                });
                accountIdMap.set(acc.id, newAccount.id);
            }

            // 3. Import Transactions
            for (const t of data.transactions) {
                const newSplits = t.splits.map((s: any) => {
                    const newAccountId = accountIdMap.get(s.accountId);
                    // If account not found (maybe it was deleted in source but transaction kept?), fallback or skip?
                    // For now, if account is missing from map, we can't link it. 
                    // But if we exported correctly, it should be there.
                    if (!newAccountId) {
                        throw new Error(`Account ID ${s.accountId} not found in import map. Integrity error.`);
                    }
                    return {
                        accountId: newAccountId,
                        amount: BigInt(s.amount),
                        units: s.units
                    };
                });

                await tx.transaction.create({
                    data: {
                        description: t.description,
                        date: new Date(t.date),
                        status: t.status,
                        userId,
                        splits: {
                            create: newSplits
                        }
                    }
                });
            }
        });

        res.json({ message: 'Import successful' });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import data' });
    }
});

export default router;
