import express from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// File upload config with size limit (5MB max)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

// Get all transactions
// Get all transactions
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limitParam = req.query.limit;
        const limit = limitParam ? parseInt(limitParam as string) : 50;

        const take = limit === -1 ? undefined : limit;
        const skip = limit === -1 ? undefined : (page - 1) * limit;

        const where: Prisma.TransactionWhereInput = {
            userId: req.user?.id,
            status: (req.query.status as any) || 'COMPLETED'
        };

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                include: {
                    splits: {
                        include: {
                            account: true
                        }
                    }
                },
                orderBy: {
                    date: 'desc',
                },
                take,
                skip,
            }),
            prisma.transaction.count({ where })
        ]);

        const serializedTransactions = transactions.map((tx: any) => ({
            ...tx,
            splits: tx.splits.map((split: any) => ({
                ...split,
                amount: split.amount.toString(),
            })),
        }));

        res.json({
            data: serializedTransactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single transaction
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const transaction = await prisma.transaction.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user?.id
            },
            include: {
                splits: {
                    include: {
                        account: true
                    }
                }
            }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({
            ...transaction,
            splits: transaction.splits.map((split: any) => ({
                ...split,
                amount: split.amount.toString(),
            })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create transaction with splits
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { description, date, splits, status } = req.body;

        // Validate splits sum to 0
        const sum = splits.reduce((acc: bigint, split: any) => acc + BigInt(split.amount), BigInt(0));
        if (sum !== BigInt(0)) {
            return res.status(400).json({ error: 'Transaction splits must sum to zero' });
        }

        // Security: Validate Account Ownership
        const accountIds = [...new Set(splits.map((s: any) => parseInt(s.accountId)))] as number[];
        const count = await prisma.account.count({
            where: {
                id: { in: accountIds },
                userId: req.user!.id
            }
        });

        if (count !== accountIds.length) {
            return res.status(403).json({ error: 'Access denied. You do not own one or more accounts involved in this transaction.' });
        }

        const transaction: any = await prisma.transaction.create({
            data: {
                description,
                date: date ? new Date(date) : new Date(),
                userId: req.user!.id,
                splits: {
                    create: splits.map((split: any) => ({
                        amount: BigInt(split.amount),
                        accountId: parseInt(split.accountId),
                        units: split.units ? split.units : null,
                    })),
                },
                status: status || 'COMPLETED',
            } as any,
            include: {
                splits: true,
            },
        });

        res.json({
            ...transaction,
            splits: transaction.splits.map((split: any) => ({
                ...split,
                amount: split.amount.toString(),
            })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update transaction
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { description, date, splits, status } = req.body;

        console.log(`[PUT /transactions/${id}] Update request:`, { description, date, status, splitsCount: splits?.length });

        // Validate splits sum to 0
        const sum = splits.reduce((acc: bigint, split: any) => acc + BigInt(split.amount), BigInt(0));
        if (sum !== BigInt(0)) {
            return res.status(400).json({ error: 'Transaction splits must sum to zero' });
        }

        // Security: Validate Account Ownership
        const accountIds = [...new Set(splits.map((s: any) => parseInt(s.accountId)))] as number[];
        const count = await prisma.account.count({
            where: {
                id: { in: accountIds },
                userId: req.user!.id
            }
        });

        if (count !== accountIds.length) {
            return res.status(403).json({ error: 'Access denied. You do not own one or more accounts involved in this transaction.' });
        }

        // Use transaction for atomicity
        const updatedTransaction = await prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
            // 1. Update Transaction details
            const tx = await prisma.transaction.update({
                where: { id: parseInt(id), userId: req.user!.id },
                data: {
                    description,
                    date: date ? new Date(date) : undefined,
                    status: status || undefined, // Allow updating status
                },
            });

            // 2. Delete existing splits
            await prisma.transactionSplit.deleteMany({
                where: { transactionId: tx.id },
            });

            // 3. Create new splits
            await prisma.transactionSplit.createMany({
                data: splits.map((split: any) => ({
                    transactionId: tx.id,
                    amount: BigInt(split.amount),
                    accountId: parseInt(split.accountId),
                    units: split.units ? split.units : null,
                })),
            });

            return prisma.transaction.findUnique({
                where: { id: tx.id },
                include: { splits: { include: { account: true } } },
            });
        });

        res.json({
            ...updatedTransaction,
            splits: updatedTransaction!.splits.map((split: any) => ({
                ...split,
                amount: split.amount.toString(),
            })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete transaction
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await prisma.transaction.delete({
            where: { id: parseInt(id), userId: req.user!.id },
        });
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Approve Draft Transaction
router.put('/:id/approve', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.transaction.findFirst({
            where: { id: parseInt(id), userId: req.user!.id }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction: any = await prisma.transaction.update({
            where: { id: parseInt(id) },
            data: { status: 'COMPLETED' } as any,
            include: { splits: { include: { account: true } } }
        });

        res.json({
            ...transaction,
            splits: transaction.splits.map((split: any) => ({
                ...split,
                amount: split.amount.toString(),
            })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Download Excel Template
router.get('/template/download', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const accounts = await prisma.account.findMany({
            where: { userId: req.user!.id },
            select: { name: true, type: true }
        });

        const workbook = new ExcelJS.Workbook();

        // 1. Data Sheet (Hidden)
        const dataSheet = workbook.addWorksheet('Data');
        dataSheet.state = 'hidden';

        // Add Account Names to Column A
        accounts.forEach((acc, index) => {
            dataSheet.getCell(`A${index + 1}`).value = acc.name;
        });

        // 2. Template Sheet
        const sheet = workbook.addWorksheet('Template');

        // Headers
        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Units', key: 'units', width: 10 },
        ];

        // Add Sample Data
        sheet.addRow(['2024-03-20', 'Grocery Store', '-1500', 'Groceries', 'EXPENSE', '']);
        sheet.addRow(['2024-03-21', 'Salary', '50000', 'Salary', 'INCOME', '']);
        sheet.addRow(['2024-03-22', 'Stock Purchase', '-10000', 'AAPL', 'ASSET', '10']);

        // Data Validation
        // We'll apply validation to rows 2-1000
        const rowCount = 1000;

        for (let i = 2; i <= rowCount; i++) {
            // Category Dropdown (Column D)
            // Reference the Data sheet Column A. 
            // Note: ExcelJS requires the formula to be explicit range or named range.
            // Let's use a safe range like A1:A1000 on Data sheet.
            const categoryCell = sheet.getCell(`D${i}`);
            categoryCell.dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Data!$A$1:$A$${Math.max(accounts.length, 1)}`]
            };

            // Type Dropdown (Column E)
            const typeCell = sheet.getCell(`E${i}`);
            typeCell.dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"INCOME,EXPENSE,ASSET,LIABILITY,EQUITY"']
            };
        }

        res.setHeader('Content-Disposition', 'attachment; filename="Transaction_Template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Import Transactions from Excel
router.post('/import', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate file type (Excel files only)
        const validMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!validMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls).' });
        }

        const { accountId } = req.body;
        if (!accountId) {
            return res.status(400).json({ error: 'Account ID is required' });
        }

        // Security: Validate Account Ownership
        const account = await prisma.account.findFirst({
            where: { id: parseInt(accountId), userId: req.user!.id }
        });

        if (!account) {
            return res.status(403).json({ error: 'Access denied. Account not found or does not belong to you.' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

        // Find the correct sheet
        let sheetName = 'Template';
        if (!workbook.Sheets[sheetName]) {
            // If 'Template' doesn't exist, find the first sheet that is NOT 'Data'
            sheetName = workbook.SheetNames.find(name => name !== 'Data') || workbook.SheetNames[0];
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            return res.status(400).json({ error: 'No valid sheet found in Excel file' });
        }

        const data = XLSX.utils.sheet_to_json(sheet);
        console.log(`Importing from sheet: ${sheetName}, found ${data.length} rows`);

        const results = await prisma.$transaction(async (tx) => {
            const importedTransactions = [];

            for (const row of data as any[]) {
                const dateStr = row['Date'];
                const description = row['Description'];
                const amount = parseFloat(row['Amount']);
                const categoryName = row['Category'];
                const typeStr = row['Type'] ? row['Type'].toUpperCase() : 'EXPENSE';
                const units = row['Units'] ? parseFloat(row['Units']) : undefined;

                if (!dateStr || !description || isNaN(amount) || !categoryName) {
                    continue; // Skip invalid rows
                }

                // Validate Type
                const validTypes = ['INCOME', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'];
                const type = validTypes.includes(typeStr) ? typeStr : 'EXPENSE';

                // Handle Excel serial date or string date
                let date: Date;
                if (typeof dateStr === 'number') {
                    date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                } else {
                    date = new Date(dateStr);
                }

                // Find or create category account
                let categoryAccount = await tx.account.findFirst({
                    where: {
                        userId: req.user!.id,
                        name: { equals: categoryName, mode: 'insensitive' }
                    }
                });

                if (!categoryAccount) {
                    categoryAccount = await tx.account.create({
                        data: {
                            name: categoryName,
                            type: type,
                            subType: 'category',
                            userId: req.user!.id
                        }
                    });
                }

                // Create Transaction
                // Split 1: Selected Account (Source)
                // Split 2: Category Account (Destination)

                // Amount logic:
                // If row amount is negative (Expense):
                // Source Account: -100 (Credit)
                // Category Account: +100 (Debit)

                // If row amount is positive (Income):
                // Source Account: +100 (Debit)
                // Category Account: -100 (Credit)

                const transactionAmount = Math.round(amount * 100); // Convert to cents/paisa

                const newTx = await tx.transaction.create({
                    data: {
                        description,
                        date,
                        userId: req.user!.id,
                        splits: {
                            create: [
                                {
                                    accountId: parseInt(accountId),
                                    amount: BigInt(transactionAmount), // Source impact matches the sign in Excel
                                },
                                {
                                    accountId: categoryAccount.id,
                                    amount: BigInt(-transactionAmount), // Counter entry
                                    units: units // Units apply to the category/investment account
                                }
                            ]
                        }
                    }
                });
                importedTransactions.push(newTx);
            }
            return importedTransactions;
        });

        res.json({ message: `Successfully imported ${results.length} transactions`, count: results.length });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import transactions' });
    }
});

export default router;
