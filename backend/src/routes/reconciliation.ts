import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { completeReconciliation, listLines, summarise, undoReconciliation, adjustmentSuggestion } from '../services/reconciliation';
import { LedgerError } from '../services/ledger';

const router = express.Router();

const parseId = (value: string): number => {
    const id = Number.parseInt(value, 10);
    if (!Number.isFinite(id)) throw new LedgerError(400, 'BAD_ACCOUNT', 'Account id is not valid.');
    return id;
};

const send = (res: express.Response, error: unknown, fallback: string) => {
    if (error instanceof LedgerError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('[reconciliation]', error);
    return res.status(500).json({ error: fallback });
};

router.get('/:accountId/lines', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const status = (req.query.status as 'all' | 'cleared' | 'uncleared') ?? 'all';
        const lines = await listLines(req.user!.id, parseId(req.params.accountId), {
            from: req.query.from as string | undefined,
            to: req.query.to as string | undefined,
            status,
        });
        res.json(lines);
    } catch (error) {
        send(res, error, 'Could not load statement lines.');
    }
});

router.get('/:accountId/summary', authenticateToken, async (req: AuthRequest, res) => {
    try {
        res.json(await summarise(req.user!.id, parseId(req.params.accountId)));
    } catch (error) {
        send(res, error, 'Could not load the reconciliation summary.');
    }
});

router.post('/:accountId/complete', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { splitIds, statementBalance } = req.body as { splitIds?: number[]; statementBalance?: string };
        const result = await completeReconciliation(req.user!.id, parseId(req.params.accountId), splitIds ?? [], statementBalance);
        res.json(result);
    } catch (error) {
        send(res, error, 'Could not complete the reconciliation.');
    }
});

router.post('/:accountId/undo', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { splitIds } = req.body as { splitIds?: number[] };
        res.json(await undoReconciliation(req.user!.id, parseId(req.params.accountId), splitIds ?? []));
    } catch (error) {
        send(res, error, 'Could not undo the reconciliation.');
    }
});

router.get('/:accountId/adjustment', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const statementBalance = String(req.query.statementBalance ?? '');
        res.json(await adjustmentSuggestion(req.user!.id, parseId(req.params.accountId), statementBalance));
    } catch (error) {
        send(res, error, 'Could not work out the adjustment.');
    }
});

export default router;
