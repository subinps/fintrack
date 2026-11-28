import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { balanceSheet, cashFlow, profitAndLoss, trialBalance } from '../services/reporting';
import { LedgerError } from '../services/ledger';

const router = express.Router();

const date = (value: unknown, fallback: Date): Date => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
    return fallback;
};

const monthStart = (): Date => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

router.get('/pnl', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const to = date(req.query.to, new Date());
        const from = date(req.query.from, monthStart());
        res.json(await profitAndLoss(req.user!.id, from, to, req.query.compare === 'true'));
    } catch (error) {
        console.error('[reports] pnl', error);
        res.status(500).json({ error: 'Could not build the profit and loss statement.' });
    }
});

router.get('/balance-sheet', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await balanceSheet(req.user!.id, date(req.query.asOf, new Date())));
    } catch (error) {
        console.error('[reports] balance sheet', error);
        res.status(500).json({ error: 'Could not build the balance sheet.' });
    }
});

router.get('/cash-flow', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const to = date(req.query.to, new Date());
        const from = date(req.query.from, monthStart());
        res.json(await cashFlow(req.user!.id, from, to));
    } catch (error) {
        console.error('[reports] cash flow', error);
        res.status(500).json({ error: 'Could not build the cash flow statement.' });
    }
});

router.get('/trial-balance', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await trialBalance(req.user!.id, date(req.query.asOf, new Date())));
    } catch (error) {
        console.error('[reports] trial balance', error);
        res.status(500).json({ error: 'Could not build the trial balance.' });
    }
});

router.post('/export-csv', authenticateToken, (req: AuthRequest, res) => {
    const rows = (req.body?.rows ?? []) as (string | number)[][];
    if (!Array.isArray(rows) || rows.length === 0) throw new LedgerError(400, 'EMPTY', 'Nothing to export.');
    const escape = (value: string | number) => {
        const text = String(value ?? '');
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fintrack-report-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
});

export default router;
