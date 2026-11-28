import express from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
    approveTransaction,
    assertOwnedAccounts,
    LedgerError,
    LedgerLine,
    postTransaction,
    restoreTransaction,
    updateTransaction,
    voidTransaction,
} from '../services/ledger';
import { serializeTransaction, serializeTransactions } from '../lib/serialize';

// File upload config with size limit (5MB max)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

const sendLedgerError = (res: express.Response, error: unknown, fallbackMessage: string) => {
    if (error instanceof LedgerError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error(error);
    return res.status(500).json({ error: fallbackMessage });
};

const linesFromBody = (splits: any[]): LedgerLine[] =>
    (splits ?? []).map((split: any) => ({
        accountId: parseInt(split.accountId),
        amount: BigInt(split.amount),
        units: split.units ?? null,
    }));


const parseStatusFilter = (raw: unknown): Prisma.TransactionWhereInput['status'] => {
    const value = typeof raw === 'string' && raw.length > 0 ? raw.toUpperCase() : 'COMPLETED';
    if (value === 'ALL') return { in: ['DRAFT', 'COMPLETED'] };
    if (value === 'COMPLETED' || value === 'DRAFT' || value === 'VOIDED') return value;
    throw new LedgerError(400, 'INVALID_STATUS', 'status must be one of COMPLETED, DRAFT, VOIDED or ALL');
};

const encodeCursor = (transaction: { date: Date; id: number }) => `${transaction.date.getTime()}_${transaction.id}`;

const decodeCursor = (raw: unknown): { date: Date; id: number } | null => {
    if (typeof raw !== 'string' || !raw.includes('_')) return null;
    const [time, id] = raw.split('_');
    const millis = Number(time);
    const parsedId = Number(id);
    if (!Number.isFinite(millis) || !Number.isFinite(parsedId)) {
        throw new LedgerError(400, 'INVALID_CURSOR', 'cursor is not valid');
    }
    return { date: new Date(millis), id: parsedId };
};

// Get all transactions
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limitParam = req.query.limit;
        const limit = limitParam ? parseInt(limitParam as string) : 50;

        const take = limit === -1 ? undefined : limit;
        const cursor = decodeCursor(req.query.cursor);
        const skip = cursor || !take ? undefined : (page - 1) * take;

        const status = parseStatusFilter(req.query.status);
        const where: Prisma.TransactionWhereInput = {
            userId: req.user?.id,
            status,
        };
        if (cursor) {
            where.OR = [
                { date: { lt: cursor.date } },
                { date: cursor.date, id: { lt: cursor.id } },
            ];
        }

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
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                take,
                skip,
            }),
            cursor ? Promise.resolve(0) : prisma.transaction.count({ where: { userId: req.user?.id, status } })
        ]);

        res.json({
            data: serializeTransactions(transactions),
            pagination: {
                total,
                page,
                limit,
                totalPages: take ? Math.ceil(total / take) : 1,
                nextCursor: take && transactions.length === take ? encodeCursor(transactions[transactions.length - 1]) : null,
            }
        });
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
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
                },
                history: {
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, action: true, actor: true, createdAt: true },
                },
            }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(serializeTransaction(transaction));
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
    }
});

// Get the full edit/void history of one transaction
router.get('/:id/history', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const transaction = await prisma.transaction.findFirst({
            where: { id: parseInt(req.params.id), userId: req.user!.id },
            select: { id: true },
        });
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        const history = await prisma.transactionHistory.findMany({
            where: { transactionId: transaction.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json(history);
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
    }
});

// Create transaction with splits
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { description, date, splits, status } = req.body;
        if (!Array.isArray(splits) || splits.length < 2) {
            return res.status(400).json({ error: 'A transaction needs at least two splits' });
        }

        const transaction = await postTransaction({
            userId: req.user!.id,
            description,
            date,
            lines: linesFromBody(splits),
            status: status === 'DRAFT' ? 'DRAFT' : 'COMPLETED',
        });

        res.json(serializeTransaction(transaction));
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
    }
});

// Update transaction
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { description, date, splits, status } = req.body;
        const lines = Array.isArray(splits) ? linesFromBody(splits) : undefined;

        const updated = await updateTransaction({
            userId: req.user!.id,
            id: parseInt(req.params.id),
            description,
            date,
            lines,
            status: status === 'DRAFT' || status === 'COMPLETED' ? status : undefined,
        });

        const withAccounts = await prisma.transaction.findUniqueOrThrow({
            where: { id: updated.id },
            include: { splits: { include: { account: true } }, history: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });

        res.json(serializeTransaction(withAccounts));
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
    }
});

// Delete transaction (soft delete: the row is kept as VOIDED and can be restored)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
        const transaction = await voidTransaction(parseInt(req.params.id), req.user!.id, reason);
        res.json({
            message: 'Transaction deleted',
            transaction: serializeTransaction(transaction),
        });
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
    }
});

// Restore a voided transaction
router.post('/:id/restore', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const transaction = await restoreTransaction(parseInt(req.params.id), req.user!.id);
        res.json(serializeTransaction(transaction));
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
    }
});

// Bulk void / approve / restore. Each item is validated on its own so one bad id
// does not discard the rest of the batch.
router.post('/bulk', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { ids, action } = req.body ?? {};
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
            return res.status(400).json({ error: 'ids must be an array of 1 to 100 transaction ids' });
        }
        if (!['void', 'approve', 'restore'].includes(action)) {
            return res.status(400).json({ error: "action must be 'void', 'approve' or 'restore'" });
        }

        const results: { id: number; status: string; error?: string }[] = [];
        for (const rawId of [...new Set(ids.map((value: unknown) => parseInt(String(value), 10)))]) {
            if (!Number.isFinite(rawId)) {
                results.push({ id: rawId, status: 'error', error: 'Invalid id' });
                continue;
            }
            try {
                if (action === 'void') {
                    const transaction = await voidTransaction(rawId, req.user!.id, typeof req.body.reason === 'string' ? req.body.reason : null);
                    results.push({ id: rawId, status: transaction.status });
                } else if (action === 'approve') {
                    const transaction = await approveTransaction(rawId, req.user!.id);
                    results.push({ id: rawId, status: transaction.status });
                } else {
                    const transaction = await restoreTransaction(rawId, req.user!.id);
                    results.push({ id: rawId, status: transaction.status });
                }
            } catch (error) {
                results.push({ id: rawId, status: 'error', error: error instanceof LedgerError ? error.message : 'Server error' });
            }
        }

        res.json({ results });
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
    }
});

// Approve Draft Transaction
router.put('/:id/approve', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const approved = await approveTransaction(parseInt(req.params.id), req.user!.id);
        const transaction = await prisma.transaction.findUniqueOrThrow({
            where: { id: approved.id },
            include: { splits: { include: { account: true } } },
        });
        res.json(serializeTransaction(transaction));
    } catch (error) {
        sendLedgerError(res, error, 'Server error');
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
                        name: { equals: categoryName, mode: 'insensitive' },
                        type,
                    }
                });

                if (!categoryAccount) {
                    try {
                        categoryAccount = await tx.account.create({
                            data: {
                                name: categoryName,
                                type: type,
                                subType: 'category',
                                userId: req.user!.id
                            }
                        });
                    } catch (error) {
                        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                            categoryAccount = await tx.account.findFirstOrThrow({
                                where: {
                                    userId: req.user!.id,
                                    name: { equals: categoryName, mode: 'insensitive' },
                                    type,
                                }
                            });
                        } else {
                            throw error;
                        }
                    }
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
                if (transactionAmount === 0) {
                    continue; // Skip rows that round to nothing
                }

                const newTx = await postTransaction({
                    client: tx,
                    userId: req.user!.id,
                    description,
                    date,
                    source: 'IMPORT',
                    lines: [
                        {
                            accountId: parseInt(accountId),
                            amount: BigInt(transactionAmount), // Source impact matches the sign in Excel
                        },
                        {
                            accountId: categoryAccount.id,
                            amount: BigInt(-transactionAmount), // Counter entry
                            units: units ?? null, // Units apply to the category/investment account
                        },
                    ],
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
