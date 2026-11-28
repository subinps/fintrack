import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { amortise, amortiseRaw, cardSummaries, loanSummaries } from '../services/loans';
import { rupeesToPaise, formatPaise } from '../lib/money';
import { serializeAccount } from '../lib/serialize';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await loanSummaries(req.user!.id));
    } catch (error) {
        console.error('[loans]', error);
        res.status(500).json({ error: 'Could not load your loans.' });
    }
});

router.get('/cards', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await cardSummaries(req.user!.id));
    } catch (error) {
        console.error('[loans] cards', error);
        res.status(500).json({ error: 'Could not load your cards.' });
    }
});

router.get('/:accountId/schedule', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const accountId = Number.parseInt(req.params.accountId, 10);
        const account = await prisma.account.findFirst({
            where: { id: accountId, userId: req.user!.id, type: 'LIABILITY' },
            select: { id: true, interestRate: true, tenureMonths: true, loanPrincipalPaise: true },
        });
        if (!account) return res.status(404).json({ error: 'Loan not found.' });

        const splits = await prisma.transactionSplit.findMany({
            where: { accountId, transaction: { userId: req.user!.id, status: { not: 'VOIDED' } } },
            select: { amount: true },
        });
        const balance = splits.reduce((sum, split) => sum + split.amount, 0n);
        const outstanding = balance < 0n ? -balance : balance;
        const principal = account.loanPrincipalPaise ?? outstanding;
        // A sanctioned loan with nothing posted yet amortises its full principal.
        const basis = outstanding > 0n ? outstanding : principal;
        const rate = account.interestRate ?? 0;
        const tenure = account.tenureMonths ?? 12;
        const extra = req.query.extra ? rupeesToPaise(String(req.query.extra)) : 0n;

        const rows = amortiseRaw(basis, rate, Math.max(1, Math.min(tenure, 600)), 600, extra);
        const interest = rows.reduce((sum, row) => sum + row.interestPaise, 0n);
        res.json({
            accountId,
            outstanding: formatPaise(outstanding),
            principal: formatPaise(principal),
            interestRate: rate,
            tenureMonths: tenure,
            extraPayment: formatPaise(extra),
            totalInterest: formatPaise(interest),
            schedule: amortise(basis, rate, Math.max(1, Math.min(tenure, 600)), 60, extra),
        });
    } catch (error) {
        console.error('[loans] schedule', error);
        res.status(500).json({ error: 'Could not build the repayment schedule.' });
    }
});

const termsSchema = z.object({
    interestRate: z.number().min(0).max(100).nullish(),
    tenureMonths: z.number().int().min(1).max(600).nullish(),
    loanPrincipalPaise: z.string().regex(/^\d+(\.\d{1,2})?$/).nullish(),
    emiPaise: z.string().regex(/^\d+(\.\d{1,2})?$/).nullish(),
    creditLimitPaise: z.string().regex(/^\d+(\.\d{1,2})?$/).nullish(),
    dueDay: z.number().int().min(1).max(31).nullish(),
    statementDay: z.number().int().min(1).max(31).nullish(),
});

router.patch('/:accountId', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const parsed = termsSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Check the loan details.', details: parsed.error.flatten() });
        const accountId = Number.parseInt(req.params.accountId, 10);
        const account = await prisma.account.findFirst({ where: { id: accountId, userId: req.user!.id }, select: { id: true } });
        if (!account) return res.status(404).json({ error: 'Account not found.' });
        const data = parsed.data;
        const toPaise = (value: string | null | undefined) => (value === null ? null : value === undefined ? undefined : rupeesToPaise(value));
        const updated = await prisma.account.update({
            where: { id: accountId },
            data: {
                ...(data.interestRate !== undefined ? { interestRate: data.interestRate } : {}),
                ...(data.tenureMonths !== undefined ? { tenureMonths: data.tenureMonths } : {}),
                ...(data.loanPrincipalPaise !== undefined ? { loanPrincipalPaise: toPaise(data.loanPrincipalPaise) } : {}),
                ...(data.emiPaise !== undefined ? { emiPaise: toPaise(data.emiPaise) } : {}),
                ...(data.creditLimitPaise !== undefined ? { creditLimitPaise: toPaise(data.creditLimitPaise) } : {}),
                ...(data.dueDay !== undefined ? { dueDay: data.dueDay } : {}),
                ...(data.statementDay !== undefined ? { statementDay: data.statementDay } : {}),
            },
            select: { id: true, name: true, interestRate: true, tenureMonths: true, loanPrincipalPaise: true, emiPaise: true, creditLimitPaise: true, dueDay: true, statementDay: true },
        });
        res.json(serializeAccount(updated));
    } catch (error) {
        console.error('[loans]', error);
        res.status(500).json({ error: 'Could not save the loan details.' });
    }
});

export default router;
