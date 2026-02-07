import express from 'express';
import { Account, TransactionSplit } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';

const router = express.Router();

// Get all accounts
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const accounts = await prisma.account.findMany({
            where: { userId: req.user?.id },
            orderBy: { name: 'asc' },
        });

        // Fetch all relevant market prices
        const symbols = accounts
            .map(a => a.symbol)
            .filter((s): s is string => !!s)
            .map(s => s.toUpperCase());

        const marketPrices = await prisma.marketPrice.findMany({
            where: {
                symbol: { in: symbols }
            }
        });

        const priceMap = new Map(marketPrices.map(mp => [mp.symbol, mp]));

        // Calculate balance for each account based on splits
        const accountsWithBalance = await Promise.all(accounts.map(async (acc: Account) => {
            const splits = await prisma.transactionSplit.findMany({
                where: {
                    accountId: acc.id,
                    transaction: { status: 'COMPLETED' }
                },
            });

            const balance = splits.reduce((sum: bigint, split: TransactionSplit) => sum + BigInt(split.amount), BigInt(0));

            // Calculate Unit Balance and Average Buy Price
            // Sort splits by date (we need to fetch transaction date)
            const sortedSplits = await prisma.transactionSplit.findMany({
                where: { accountId: acc.id },
                include: { transaction: true },
                orderBy: { transaction: { date: 'asc' } }
            });

            // Check for Opening Balance transaction
            const openingTx = sortedSplits.find(s => s.transaction.description.toLowerCase().includes('opening balance'));

            // If no Opening Balance transaction exists, but account has initial units (e.g. 0 cost basis), use that as starting point
            let currentUnits = (!openingTx && acc.units) ? Number(acc.units) : 0;
            let currentCostBasis = 0;

            for (const split of sortedSplits) {
                let units = split.units ? Number(split.units.toString()) : 0;
                const amount = Number(split.amount);

                // Legacy Fix: If Opening Balance has no units, use Account.units
                if (openingTx && split === openingTx && units === 0 && acc.units) {
                    units = Number(acc.units);
                }

                if (units > 0) {
                    // Buy
                    currentUnits += units;
                    currentCostBasis += amount;
                } else if (units < 0) {
                    // Sell
                    if (currentUnits > 0) {
                        const avgCost = currentCostBasis / currentUnits;
                        currentCostBasis -= (Math.abs(units) * avgCost);
                        currentUnits += units; // units is negative
                    } else {
                        // Selling short or error state, just adjust units
                        currentUnits += units;
                    }
                }
            }

            const averageBuyPrice = currentUnits > 0 ? currentCostBasis / currentUnits : 0;

            // Merge Market Price
            let lastMarketPrice = acc.lastMarketPrice;
            let lastMarketUpdate = acc.lastMarketUpdate;

            if (acc.symbol) {
                const mp = priceMap.get(acc.symbol.toUpperCase());
                if (mp) {
                    lastMarketPrice = mp.price;
                    lastMarketUpdate = mp.lastUpdated;
                }
            }

            return {
                ...acc,
                balance: balance.toString(),
                units: currentUnits || acc.units,
                averageBuyPrice,
                lastMarketPrice,
                lastMarketUpdate
            };
        }));

        res.json(accountsWithBalance);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create account
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { name, type, subType, interestRate, dueDate, symbol, units, openingBalance, lastMarketPrice } = req.body;

        // Auto-create category if it doesn't exist
        if (subType) {
            const existingCategory = await prisma.category.findFirst({
                where: {
                    userId: req.user!.id,
                    type,
                    name: subType
                }
            });

            if (!existingCategory) {
                await prisma.category.create({
                    data: {
                        userId: req.user!.id,
                        type,
                        name: subType
                    }
                });
            }
        }

        const account = await prisma.account.create({
            data: {
                name,
                type,
                subType,
                interestRate: interestRate ? parseFloat(interestRate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                symbol,
                units: units ? parseFloat(units) : null,
                lastMarketPrice: lastMarketPrice ? parseFloat(lastMarketPrice) : null,
                userId: req.user!.id,
            },
        });

        // Handle Opening Balance
        if (openingBalance && parseFloat(openingBalance) !== 0) {
            const amount = BigInt(Math.round(parseFloat(openingBalance) * 100)); // Assuming 2 decimal places

            // Find or Create 'Opening Balance Equity' account
            let equityAccount = await prisma.account.findFirst({
                where: {
                    userId: req.user!.id,
                    name: 'Opening Balance Equity',
                    type: 'EQUITY'
                }
            });

            if (!equityAccount) {
                equityAccount = await prisma.account.create({
                    data: {
                        name: 'Opening Balance Equity',
                        type: 'EQUITY',
                        userId: req.user!.id,
                    }
                });
            }

            // Determine Debit/Credit based on Account Type
            // Asset/Expense: Debit (+) is increase.
            // Liability/Income/Equity: Credit (-) is increase.

            let split1Amount = BigInt(0);
            let split2Amount = BigInt(0);

            if (type === 'ASSET' || type === 'EXPENSE') {
                split1Amount = amount; // Debit
                split2Amount = -amount; // Credit
            } else {
                // LIABILITY, INCOME, EQUITY
                split1Amount = -amount; // Credit
                split2Amount = amount; // Debit
            }

            await prisma.transaction.create({
                data: {
                    description: 'Opening Balance',
                    date: new Date(),
                    userId: req.user!.id,
                    splits: {
                        create: [
                            {
                                accountId: account.id,
                                amount: split1Amount,
                                units: units ? parseFloat(units) : null // Add units here
                            },
                            { accountId: equityAccount.id, amount: split2Amount }
                        ]
                    }
                }
            });
        }

        res.json({
            ...account,
            balance: openingBalance ? (Math.round(parseFloat(openingBalance) * 100)).toString() : '0',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update account
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { name, type, subType, interestRate, dueDate, symbol, units, lastMarketPrice } = req.body;

        // Auto-create category if it doesn't exist
        if (subType) {
            const existingCategory = await prisma.category.findFirst({
                where: {
                    userId: req.user!.id,
                    type,
                    name: subType
                }
            });

            if (!existingCategory) {
                await prisma.category.create({
                    data: {
                        userId: req.user!.id,
                        type,
                        name: subType
                    }
                });
            }
        }

        const account = await prisma.account.update({
            where: { id: parseInt(id), userId: req.user!.id },
            data: {
                name,
                type,
                subType,
                interestRate: interestRate ? parseFloat(interestRate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                symbol,
                units: units ? parseFloat(units) : null,
                lastMarketPrice: lastMarketPrice ? parseFloat(lastMarketPrice) : null,
            },
        });

        // Fetch balance
        const splits = await prisma.transactionSplit.findMany({
            where: { accountId: account.id },
        });
        const balance = splits.reduce((sum: bigint, split: TransactionSplit) => sum + BigInt(split.amount), BigInt(0));

        res.json({
            ...account,
            balance: balance.toString(),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update market price
router.patch('/:id/price', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { price } = req.body;

        if (!price) {
            return res.status(400).json({ error: 'Price is required' });
        }

        const account = await prisma.account.update({
            where: { id: parseInt(id), userId: req.user!.id },
            data: {
                lastMarketPrice: price,
                lastMarketUpdate: new Date(),
            },
        });

        res.json(account);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete account
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        // Find all transactions involving this account
        // We need to find transactions where ANY split involves this account
        const transactionsToDelete = await prisma.transaction.findMany({
            where: {
                userId,
                splits: {
                    some: {
                        accountId: parseInt(id)
                    }
                }
            },
            select: { id: true }
        });

        const transactionIds = transactionsToDelete.map(t => t.id);

        await prisma.$transaction(async (tx) => {
            // 1. Delete all associated transactions
            if (transactionIds.length > 0) {
                await tx.transaction.deleteMany({
                    where: {
                        id: { in: transactionIds }
                    }
                });
            }

            // 2. Delete the account
            await tx.account.delete({
                where: { id: parseInt(id), userId },
            });
        });

        res.json({ message: 'Account and associated transactions deleted' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper to calculate ledger data
async function calculateLedgerData(accountId: number, startDate?: string, endDate?: string) {
    const whereClause: any = {
        accountId,
        transaction: { status: 'COMPLETED' }
    };

    // If we have a start date, we need to calculate opening balance up to that date
    let openingBalance = BigInt(0);

    if (startDate) {
        const previousSplits = await prisma.transactionSplit.findMany({
            where: {
                accountId,
                transaction: {
                    date: { lt: new Date(startDate) }
                }
            }
        });
        openingBalance = previousSplits.reduce((sum, split) => sum + BigInt(split.amount), BigInt(0));

        whereClause.transaction = {
            date: { gte: new Date(startDate) }
        };
    }

    if (endDate) {
        whereClause.transaction = {
            ...whereClause.transaction,
            date: {
                ...whereClause.transaction?.date,
                lte: new Date(endDate)
            }
        };
    }

    const splits = await prisma.transactionSplit.findMany({
        where: whereClause,
        include: {
            transaction: {
                include: {
                    splits: {
                        include: { account: true }
                    }
                }
            }
        },
        orderBy: { transaction: { date: 'asc' } }
    });

    const rows: any[] = [];
    let runningBalance = openingBalance;

    // If there is an opening balance from previous period, add it as a row
    if (startDate && openingBalance !== BigInt(0)) {
        rows.push({
            id: 'opening',
            date: startDate,
            description: 'Opening Balance',
            accountInvolved: '-',
            debit: openingBalance > 0 ? (Number(openingBalance) / 100).toFixed(2) : '',
            credit: openingBalance < 0 ? (Math.abs(Number(openingBalance)) / 100).toFixed(2) : '',
            balance: (Number(runningBalance) / 100).toFixed(2),
            isOpening: true
        });
    }

    splits.forEach(split => {
        const amount = BigInt(split.amount);
        runningBalance += amount;

        const transaction = split.transaction;
        const otherSplits = transaction.splits.filter(s => s.id !== split.id);

        const mySign = amount > 0 ? 1 : -1;
        const opposingSplits = otherSplits.filter(s => {
            const sAmount = BigInt(s.amount);
            return (sAmount > 0 ? 1 : -1) !== mySign;
        });

        if (opposingSplits.length > 0) {
            opposingSplits.forEach(oppSplit => {
                // Logic: If I am debited 100, and there are 2 credits of 50 each.
                // I want to show 2 rows of 50 debit each.
                // But wait, if I have 1 split and they have 2, I can't easily split my amount unless I know the ratio.
                // Simplified Logic: 
                // If 1-to-1 or 1-to-Many (where I am the 1), we can show details.
                // If Many-to-Many or Many-to-1 (where I am one of Many), it's harder.

                // For now, let's stick to the previous logic:
                // We just list the opposing account. 
                // BUT, we need to be careful about the amount. 
                // If we just list opposing amount, it might not sum up to my amount if there are multiple of me.

                // Let's use the "Account Involved" column to list them, but keep the amount as MY amount split?
                // No, the user wants to see "What did I spend this 100 on?" -> "50 for Food, 50 for Tax".

                // If I am the only split on my side:
                const mySideSplits = transaction.splits.filter(s => (BigInt(s.amount) > 0 ? 1 : -1) === mySign);

                if (mySideSplits.length === 1) {
                    // I am the only one on my side. I can split my row into multiple rows based on opposing splits.
                    const oppAmount = BigInt(oppSplit.amount);
                    // The amount shown for this row should be the portion of MY amount that corresponds to this opposing split.
                    // Since I am the only one, the opposing split's amount (inverted) is exactly what corresponds to me.
                    const rowAmount = -oppAmount;

                    let debit = '';
                    let credit = '';

                    if (rowAmount > 0) {
                        debit = (Number(rowAmount) / 100).toFixed(2);
                    } else if (rowAmount < 0) {
                        credit = (Math.abs(Number(rowAmount)) / 100).toFixed(2);
                    }

                    rows.push({
                        id: transaction.id,
                        date: transaction.date.toISOString().split('T')[0],
                        description: transaction.description,
                        accountInvolved: oppSplit.account.name,
                        debit,
                        credit,
                        balance: (Number(runningBalance) / 100).toFixed(2), // Note: This running balance is technically "after the whole transaction", but for display we might want intermediate? 
                        // Actually, showing the same final balance for all rows of the same transaction is common in some ledgers, 
                        // OR we calculate intermediate. Let's stick to final balance for simplicity for now, or it gets very complex.
                        // Wait, if we split into rows, the balance should update row by row?
                        // If we split 100 into 50 and 50.
                        // Row 1: 50. Balance = Start + 50.
                        // Row 2: 50. Balance = Start + 100.
                        // Yes, that looks better.
                    });
                } else {
                    // Complex case (Many-to-Many). Just show one row for me.
                    // We can't easily attribute specific opposing splits to me.
                    // Fallback to single row.
                    // But we are inside a loop of opposing splits? No, we need to break this.
                }
            });

            // If we were in the "Complex" case, we didn't push any rows yet.
            const mySideSplits = transaction.splits.filter(s => (BigInt(s.amount) > 0 ? 1 : -1) === mySign);
            if (mySideSplits.length > 1) {
                let debit = '';
                let credit = '';

                if (amount > 0) {
                    debit = (Number(amount) / 100).toFixed(2);
                } else if (amount < 0) {
                    credit = (Math.abs(Number(amount)) / 100).toFixed(2);
                }

                rows.push({
                    id: transaction.id,
                    date: transaction.date.toISOString().split('T')[0],
                    description: transaction.description,
                    accountInvolved: 'Split / Multiple',
                    debit,
                    credit,
                    balance: (Number(runningBalance) / 100).toFixed(2)
                });
            } else {
                // We handled the 1-to-Many case above.
                // BUT wait, the running balance logic in the loop above was tricky.
                // If we split into multiple rows, we need to increment running balance per row.
                // Let's re-do the loop to handle balance correctly.
            }
        } else {
            // No opposing splits? (e.g. unbalanced transaction or error). Show raw.
            let debit = '';
            let credit = '';

            if (amount > 0) {
                debit = (Number(amount) / 100).toFixed(2);
            } else if (amount < 0) {
                credit = (Math.abs(Number(amount)) / 100).toFixed(2);
            }

            rows.push({
                id: transaction.id,
                date: transaction.date.toISOString().split('T')[0],
                description: transaction.description,
                accountInvolved: 'Unknown',
                debit,
                credit,
                balance: (Number(runningBalance) / 100).toFixed(2)
            });
        }
    });

    // RE-IMPLEMENTING LOOP FOR CORRECT BALANCE
    // Clear rows and re-calculate to be safe and clean
    const finalRows: any[] = [];
    let currentBalance = openingBalance;

    if (startDate && openingBalance !== BigInt(0)) {
        finalRows.push({
            id: 'opening',
            date: startDate,
            description: 'Opening Balance',
            accountInvolved: '-',
            debit: openingBalance > 0 ? (Number(openingBalance) / 100).toFixed(2) : '',
            credit: openingBalance < 0 ? (Math.abs(Number(openingBalance)) / 100).toFixed(2) : '',
            balance: (Number(currentBalance) / 100).toFixed(2),
            isOpening: true
        });
    }

    splits.forEach(split => {
        const amount = BigInt(split.amount);
        // Don't add to balance yet, add per row

        const transaction = split.transaction;
        const otherSplits = transaction.splits.filter(s => s.id !== split.id);
        const mySign = amount > 0 ? 1 : -1;
        const mySideSplits = transaction.splits.filter(s => (BigInt(s.amount) > 0 ? 1 : -1) === mySign);

        const opposingSplits = otherSplits.filter(s => {
            const sAmount = BigInt(s.amount);
            return (sAmount > 0 ? 1 : -1) !== mySign;
        });

        if (mySideSplits.length === 1 && opposingSplits.length > 0) {
            // 1-to-Many (I am the 1). Split into multiple rows.
            opposingSplits.forEach((oppSplit, index) => {
                const oppAmount = BigInt(oppSplit.amount);
                const rowAmount = -oppAmount; // This part of MY amount corresponds to this opposing split

                currentBalance += rowAmount;

                let debit = '';
                let credit = '';
                if (rowAmount > 0) debit = (Number(rowAmount) / 100).toFixed(2);
                else if (rowAmount < 0) credit = (Math.abs(Number(rowAmount)) / 100).toFixed(2);

                finalRows.push({
                    id: `${transaction.id}-${index}`,
                    transactionId: transaction.id,
                    date: transaction.date.toISOString().split('T')[0],
                    description: transaction.description,
                    accountInvolved: oppSplit.account.name,
                    accountInvolvedId: oppSplit.account.id,
                    debit,
                    credit,
                    balance: (Number(currentBalance) / 100).toFixed(2)
                });
            });
        } else {
            // Many-to-Many or Simple 1-to-1 or No-Opposing.
            currentBalance += amount;

            let debit = '';
            let credit = '';
            if (amount > 0) debit = (Number(amount) / 100).toFixed(2);
            else if (amount < 0) credit = (Math.abs(Number(amount)) / 100).toFixed(2);

            let accountInvolved = 'Split / Multiple';
            let accountInvolvedId: number | null = null;

            if (opposingSplits.length === 1) {
                accountInvolved = opposingSplits[0].account.name;
                accountInvolvedId = opposingSplits[0].account.id;
            } else if (opposingSplits.length === 0) {
                accountInvolved = 'Unknown';
            }

            finalRows.push({
                id: `${transaction.id}-0`,
                transactionId: transaction.id,
                date: transaction.date.toISOString().split('T')[0],
                description: transaction.description,
                accountInvolved,
                accountInvolvedId,
                debit,
                credit,
                balance: (Number(currentBalance) / 100).toFixed(2)
            });
        }
    });

    return finalRows;
}

// Get Ledger Data (JSON)
router.get('/:id/ledger', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        const userId = req.user!.id;

        const account = await prisma.account.findFirst({
            where: { id: parseInt(id), userId }
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const rows = await calculateLedgerData(
            parseInt(id),
            startDate as string,
            endDate as string
        );

        res.json(rows);
    } catch (error) {
        console.error('Ledger error:', error);
        res.status(500).json({ error: 'Failed to fetch ledger' });
    }
});

// Export Ledger (Excel)
router.get('/:id/export', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        const userId = req.user!.id;

        const account = await prisma.account.findFirst({
            where: { id: parseInt(id), userId }
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const rows = await calculateLedgerData(
            parseInt(id),
            startDate as string,
            endDate as string
        );

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Ledger');

        sheet.columns = [
            { header: 'Trans ID', key: 'id', width: 10 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Account Involved', key: 'accountInvolved', width: 30 },
            { header: 'Debit', key: 'debit', width: 15 },
            { header: 'Credit', key: 'credit', width: 15 },
            { header: 'Balance', key: 'balance', width: 15 },
        ];

        rows.forEach(row => {
            sheet.addRow(row);
        });

        res.setHeader('Content-Disposition', `attachment; filename="ledger_${account.name.replace(/[^a-z0-9]/gi, '_')}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export ledger' });
    }
});

export default router;
