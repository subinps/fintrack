import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { assertOwnedAccounts, LedgerError, postTransaction } from '../services/ledger';
import { matchRules, normaliseRows, annotateRows, importKey, readFile, suggestMapping, type ColumnMapping, type ImportMode } from '../services/statements';
import { formatPaise, rupeesToPaise } from '../lib/money';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /\.(csv|tsv|txt|xlsx|xls|ofx|qfx)$/i.test(file.originalname);
        if (!ok) return cb(new Error('Upload a CSV, Excel or OFX file.'));
        cb(null, true);
    },
});

const send = (res: express.Response, error: unknown, fallback: string) => {
    if (error instanceof LedgerError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    const message = error instanceof Error ? error.message : fallback;
    console.error('[import]', error);
    return res.status(400).json({ error: message });
};

const OWNED_ACCOUNT = async (userId: string, accountId: number) => {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true, name: true, type: true } });
    if (!account) throw new LedgerError(404, 'ACCOUNT_NOT_FOUND', 'Account not found.');
    return account;
};

// ---------------------------------------------------------------------------
// File preview
// ---------------------------------------------------------------------------

router.post('/preview', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        const accountId = Number.parseInt(String(req.body.accountId ?? ''), 10);
        if (!Number.isFinite(accountId)) throw new LedgerError(400, 'ACCOUNT_REQUIRED', 'Choose the account this file belongs to.');
        if (!req.file) throw new LedgerError(400, 'FILE_REQUIRED', 'Choose a file to import.');
        const mode: ImportMode = req.body.mode === 'statement' ? 'statement' : 'ledger';
        await OWNED_ACCOUNT(req.user!.id, accountId);

        const reading = readFile({ buffer: req.file.buffer, originalname: req.file.originalname });
        let mapping = suggestMapping(reading.headers);
        if (req.body.mapping) {
            try {
                const supplied = JSON.parse(req.body.mapping) as Partial<ColumnMapping>;
                mapping = { ...mapping, ...supplied };
            } catch {
                /* keep the suggestion */
            }
        }
        const rows = normaliseRows(reading, mapping).slice(0, 1000);
        const annotated = await annotateRows(req.user!.id, accountId, rows, mode);
        const total = annotated.reduce((sum, row) => (row.error ? sum : sum + rupeesToPaise(row.amount)), 0n);

        res.json({
            source: reading.source,
            headers: reading.headers,
            mapping,
            rows: annotated,
            summary: {
                count: annotated.length,
                sum: formatPaise(total),
                duplicates: annotated.filter((row) => row.duplicate).length,
                matched: annotated.filter((row) => row.match).length,
                invalid: annotated.filter((row) => row.error).length,
            },
        });
    } catch (error) {
        send(res, error, 'Could not read that file.');
    }
});

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

const commitSchema = z.object({
    accountId: z.number().int().positive(),
    mode: z.enum(['ledger', 'statement']).default('ledger'),
    skipDuplicates: z.boolean().default(true),
    rows: z
        .array(
            z.object({
                date: z.string().min(4),
                description: z.string().min(1).max(240),
                amount: z.string().min(1),
                categoryAccountId: z.number().int().positive().nullish(),
                matchSplitId: z.number().int().positive().nullish(),
                externalId: z.string().max(120).nullish(),
            })
        )
        .min(1)
        .max(1000),
});

router.post('/commit', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const parsed = commitSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Check the rows you are importing.', details: parsed.error.flatten() });
        }
        const { accountId, mode, rows, skipDuplicates } = parsed.data;
        const userId = req.user!.id;
        await OWNED_ACCOUNT(userId, accountId);

        let uncategorisedIncome: number | null = null;
        let uncategorisedExpense: number | null = null;
        const ensureUncategorised = async (type: 'INCOME' | 'EXPENSE') => {
            const cached = type === 'INCOME' ? uncategorisedIncome : uncategorisedExpense;
            if (cached) return cached;
            const existing = await prisma.account.findFirst({
                where: { userId, name: 'Uncategorised', type },
                select: { id: true },
            });
            const account = existing ?? (await prisma.account.create({ data: { userId, name: 'Uncategorised', type, subType: 'category' }, select: { id: true } }));
            if (type === 'INCOME') uncategorisedIncome = account.id;
            else uncategorisedExpense = account.id;
            return account.id;
        };

        const result = { posted: 0, skipped: 0, reconciled: 0, failed: [] as { index: number; error: string }[] };

        if (mode === 'statement') {
            const matched = rows.filter((row) => row.matchSplitId).map((row) => row.matchSplitId!) ;
            if (matched.length > 0) {
                const updated = await prisma.transactionSplit.updateMany({
                    where: { id: { in: matched }, accountId, transaction: { userId } },
                    data: { reconciledAt: new Date(), statementRunId: `statement:${new Date().toISOString().slice(0, 10)}` },
                });
                result.reconciled = updated.count;
            }
        }

        const toPost = rows.filter((row) => !(mode === 'statement' && row.matchSplitId));

        for (let index = 0; index < toPost.length; index += 1) {
            const row = toPost[index];
            try {
                const paise = rupeesToPaise(row.amount);
                if (paise === 0n) {
                    result.skipped += 1;
                    continue;
                }
                const key = importKey(accountId, row);
                if (skipDuplicates) {
                    const already = await prisma.transaction.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
                    if (already) {
                        result.skipped += 1;
                        continue;
                    }
                }

                let categoryId = row.categoryAccountId ?? null;
                if (!categoryId) {
                    const rule = await matchRules(userId, row.description);
                    categoryId = rule?.accountId ?? (await ensureUncategorised(paise < 0n ? 'EXPENSE' : 'INCOME'));
                } else {
                    await assertOwnedAccounts(userId, [categoryId]);
                }

                const created = await postTransaction({
                    userId,
                    description: row.description,
                    date: new Date(`${row.date}T12:00:00Z`),
                    source: 'IMPORT',
                    idempotencyKey: key,
                    lines: [
                        { accountId, amount: paise },
                        { accountId: categoryId, amount: -paise },
                    ],
                });

                if (mode === 'statement') {
                    await prisma.transactionSplit.updateMany({
                        where: { transactionId: created.id, accountId },
                        data: { reconciledAt: new Date(), statementRunId: `statement:${new Date().toISOString().slice(0, 10)}` },
                    });
                }
                result.posted += 1;
            } catch (error) {
                result.failed.push({ index, error: error instanceof Error ? error.message : 'Could not post this row.' });
            }
        }

        res.json(result);
    } catch (error) {
        send(res, error, 'Could not import those rows.');
    }
});

// ---------------------------------------------------------------------------
// Import rules
// ---------------------------------------------------------------------------

const ruleSchema = z.object({
    name: z.string().min(1).max(80),
    matchType: z.enum(['CONTAINS', 'EQUALS', 'REGEX']).default('CONTAINS'),
    pattern: z.string().min(1).max(160),
    accountId: z.number().int().positive(),
    priority: z.number().int().min(1).max(1000).default(100),
    active: z.boolean().default(true),
});

router.get('/rules', authenticateToken, async (req: AuthRequest, res) => {
    const rules = await prisma.importRule.findMany({
        where: { userId: req.user!.id },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: { account: { select: { id: true, name: true, type: true } } },
    });
    res.json(rules);
});

router.post('/rules', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const parsed = ruleSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Check the rule fields.', details: parsed.error.flatten() });
        await assertOwnedAccounts(req.user!.id, [parsed.data.accountId]);
        if (parsed.data.matchType === 'REGEX') new RegExp(parsed.data.pattern);
        const rule = await prisma.importRule.create({
            data: { ...parsed.data, userId: req.user!.id },
            include: { account: { select: { id: true, name: true, type: true } } },
        });
        res.status(201).json(rule);
    } catch (error) {
        send(res, error, 'Could not save that rule.');
    }
});

router.patch('/rules/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.importRule.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
        if (!existing) return res.status(404).json({ error: 'Rule not found.' });
        const parsed = ruleSchema.partial().safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Check the rule fields.', details: parsed.error.flatten() });
        if (parsed.data.accountId) await assertOwnedAccounts(req.user!.id, [parsed.data.accountId]);
        const rule = await prisma.importRule.update({
            where: { id: existing.id },
            data: parsed.data,
            include: { account: { select: { id: true, name: true, type: true } } },
        });
        res.json(rule);
    } catch (error) {
        send(res, error, 'Could not update that rule.');
    }
});

router.delete('/rules/:id', authenticateToken, async (req: AuthRequest, res) => {
    const deleted = await prisma.importRule.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (deleted.count === 0) return res.status(404).json({ error: 'Rule not found.' });
    res.json({ deleted: deleted.count });
});

router.post('/rules/test', authenticateToken, async (req: AuthRequest, res) => {
    const description = String(req.body?.description ?? '');
    if (!description.trim()) return res.status(400).json({ error: 'Type a description to test.' });
    const rule = await matchRules(req.user!.id, description);
    res.json({ description, match: rule });
});

// ---------------------------------------------------------------------------
// Saved views (transaction filters the user keeps)
// ---------------------------------------------------------------------------

const viewSchema = z.object({
    name: z.string().min(1).max(60),
    filters: z.record(z.string(), z.unknown()),
});

router.get('/views', authenticateToken, async (req: AuthRequest, res) => {
    const views = await prisma.savedView.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'asc' } });
    res.json(views);
});

router.post('/views', authenticateToken, async (req: AuthRequest, res) => {
    const parsed = viewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Give the view a name.' });
    const view = await prisma.savedView.create({
        data: { userId: req.user!.id, name: parsed.data.name, filters: parsed.data.filters as Prisma.InputJsonValue },
    });
    res.status(201).json(view);
});

router.patch('/views/:id', authenticateToken, async (req: AuthRequest, res) => {
    const parsed = viewSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the view fields.' });
    const existing = await prisma.savedView.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) return res.status(404).json({ error: 'View not found.' });
    const view = await prisma.savedView.update({
        where: { id: existing.id },
        data: { ...(parsed.data.name ? { name: parsed.data.name } : {}), ...(parsed.data.filters ? { filters: parsed.data.filters as Prisma.InputJsonValue } : {}) },
    });
    res.json(view);
});

router.delete('/views/:id', authenticateToken, async (req: AuthRequest, res) => {
    const deleted = await prisma.savedView.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (deleted.count === 0) return res.status(404).json({ error: 'View not found.' });
    res.json({ deleted: deleted.count });
});

export default router;
