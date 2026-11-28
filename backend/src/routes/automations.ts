import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { badRequest, parseBody, readLimiter, writeLimiter } from '../lib/validation';
import {
    decryptSecrets,
    encryptSecrets,
    isCronExpression,
    runAutomation,
    runAutomationSweep,
    MAX_POSTS_PER_RUN,
    SCRIPT_TIMEOUT_MS,
    MEMORY_LIMIT_BYTES,
} from '../services/automation';

const router = Router();

const triggerTypeSchema = z.enum(['MANUAL', 'SCHEDULE', 'EVENT', 'WEBHOOK']);
const eventSchema = z.enum([
    'transaction.created',
    'transaction.updated',
    'transaction.voided',
    'transaction.restored',
    'transaction.completed',
    'account.changed',
]);

const scriptSchema = z.string().trim().min(1, 'A script cannot be empty').max(20_000, 'Scripts are limited to 20,000 characters');
const variablesSchema = z.record(z.string(), z.union([z.string().max(200), z.number()])).default({});
const secretsSchema = z.record(z.string(), z.string().max(400)).default({});
const triggerConfigSchema = z.record(z.string(), z.unknown()).default({});

const automationFields = {
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).nullish(),
    triggerType: triggerTypeSchema.default('MANUAL'),
    triggerConfig: triggerConfigSchema,
    script: scriptSchema,
    variables: variablesSchema,
    secrets: secretsSchema,
    isActive: z.boolean().default(false),
};

function validateTrigger(
    triggerType: string,
    triggerConfig: Record<string, unknown>
): { ok: true } | { ok: false; error: string; field: string } {
    if (triggerType === 'SCHEDULE') {
        const cron = typeof triggerConfig.cron === 'string' ? triggerConfig.cron.trim() : '';
        if (!cron || !isCronExpression(cron)) {
            return { ok: false, error: 'A schedule needs a 5-field cron expression, for example 0 9 * * 1', field: 'triggerConfig.cron' };
        }
    }
    if (triggerType === 'EVENT') {
        const events = Array.isArray(triggerConfig.events) ? triggerConfig.events : [];
        if (!events.length || !events.every((event) => eventSchema.safeParse(event).success)) {
            return { ok: false, error: 'Pick at least one ledger event to listen to', field: 'triggerConfig.events' };
        }
    }
    return { ok: true };
}

const createSchema = z.object(automationFields);
const updateSchema = z
    .object({
        name: automationFields.name.optional(),
        description: automationFields.description,
        triggerType: triggerTypeSchema.optional(),
        triggerConfig: z.record(z.string(), z.unknown()).optional(),
        script: scriptSchema.optional(),
        variables: variablesSchema.optional(),
        secrets: secretsSchema.optional(),
        isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const runSchema = z.object({ dryRun: z.boolean().optional() }).default({});

const json = (value: Record<string, unknown> | Record<string, string | number>): Prisma.InputJsonValue =>
    value as Prisma.InputJsonValue;

type AutomationRow = {
    id: string;
    name: string;
    description: string | null;
    triggerType: string;
    triggerConfig: unknown;
    script: string;
    variables: unknown;
    encryptedSecrets: string | null;
    secretsIv: string | null;
    isActive: boolean;
    failCount: number;
    lastRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

const serialise = (row: AutomationRow, lastRun?: { status: string; createdAt: Date } | null) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.triggerType,
    triggerConfig: row.triggerConfig ?? {},
    script: row.script,
    variables: row.variables ?? {},
    secretKeys: Object.keys(decryptSecrets(row.encryptedSecrets, row.secretsIv)),
    isActive: row.isActive,
    failCount: row.failCount,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastRunStatus: lastRun?.status ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
});

const serialiseRun = (run: {
    id: string;
    trigger: string;
    status: string;
    logs: unknown;
    error: string | null;
    transactionIds: number[];
    durationMs: number;
    isDryRun: boolean;
    createdAt: Date;
}) => ({
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    logs: Array.isArray(run.logs) ? (run.logs as string[]) : [],
    error: run.error,
    transactionIds: run.transactionIds,
    durationMs: run.durationMs,
    isDryRun: run.isDryRun,
    createdAt: run.createdAt.toISOString(),
});

async function nextVersion(automationId: string): Promise<number> {
    const latest = await prisma.automationVersion.findFirst({
        where: { automationId },
        orderBy: { version: 'desc' },
        select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
}

const hashSecret = (secret: string) => crypto.createHash('sha256').update(secret).digest('hex');

// Webhook trigger: unauthenticated by design, keyed by the automation's own secret.
router.post('/hooks/:id', writeLimiter, async (req, res) => {
    const id = String(req.params.id);
    const key = String(req.header('x-automation-key') ?? '');
    if (!key) return res.status(401).json({ error: 'Missing x-automation-key header', code: 'UNAUTHORIZED' });

    const automation = await prisma.automation.findUnique({
        where: { id },
        select: { id: true, userId: true, triggerType: true, isActive: true, archivedAt: true, webhookSecretHash: true },
    });
    if (!automation || automation.archivedAt || automation.triggerType !== 'WEBHOOK') {
        return res.status(404).json({ error: 'Webhook not found', code: 'NOT_FOUND' });
    }
    const expected = automation.webhookSecretHash ?? '';
    const provided = hashSecret(key);
    if (!expected || expected.length !== provided.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
        return res.status(401).json({ error: 'Invalid automation key', code: 'UNAUTHORIZED' });
    }
    if (!automation.isActive) return res.status(409).json({ error: 'Automation is paused', code: 'AUTOMATION_PAUSED' });

    const result = await runAutomation({ automationId: automation.id, userId: automation.userId, trigger: 'WEBHOOK' });
    res.status(result.status === 'FAILED' ? 422 : 200).json({ data: result });
});

router.use(authenticateToken);

/** Starter scripts for the empty state; they only reference accounts by name. */
const TEMPLATES = [
    {
        id: 'pay-yourself-first',
        name: 'Pay yourself first',
        description: 'Every Monday at 9am, moves a fixed amount into your second asset account.',
        triggerType: 'SCHEDULE',
        triggerConfig: { cron: '0 9 * * 1' },
        variables: { amountPaise: 500000 },
        script: `const asset = accounts.filter((a) => a.type === 'ASSET');
const liquid = asset.filter((a) => ['Bank', 'Cash', 'Savings'].includes(a.subType));
const pool = (liquid.length > 1 ? liquid : asset).slice().sort((a, b) => b.balancePaise - a.balancePaise);
const from = pool.find((a) => a.name === vars.from) || pool[0];
const to = pool.find((a) => a.name === vars.to) || pool[1];
if (!from || !to || from.name === to.name) throw new Error('Add another asset account to move money into');
const amount = Number(vars.amountPaise || 500000);
if (amount <= 0) throw new Error('Set vars.amountPaise to the amount to save');
post('Weekly savings transfer', [
  { account: from.name, amount: -amount },
  { account: to.name, amount }
], { date: today() });
log('Moved ' + (amount / 100).toFixed(2) + ' from ' + from.name + ' to ' + to.name);`,
    },
    {
        id: 'month-end-sweep',
        name: 'Month-end sweep',
        description: 'Ends every month by sweeping cash above your buffer into your second asset account.',
        triggerType: 'SCHEDULE',
        triggerConfig: { cron: '0 18 28 * *' },
        variables: { keepPaise: 1000000 },
        script: `const asset = accounts.filter((a) => a.type === 'ASSET');
const liquid = asset.filter((a) => ['Bank', 'Cash', 'Savings'].includes(a.subType));
const pool = (liquid.length > 1 ? liquid : asset).slice().sort((a, b) => b.balancePaise - a.balancePaise);
const from = pool.find((a) => a.name === vars.from) || pool[0];
const to = pool.find((a) => a.name === vars.to) || pool[1];
if (!from || !to || from.name === to.name) throw new Error('Add another asset account to sweep into');
const keep = Number(vars.keepPaise || 1000000);
const spare = from.balancePaise - keep;
if (spare <= 0) {
  log('Nothing to sweep, balance ' + from.balancePaise);
} else {
  post('Month-end sweep', [
    { account: from.name, amount: -spare },
    { account: to.name, amount: spare }
  ], { date: today() });
  log('Swept ' + (spare / 100).toFixed(2) + ' from ' + from.name + ' to ' + to.name);
}`,
    },
    {
        id: 'budget-watch',
        name: 'Budget watch',
        description: 'After every transaction, logs any budget running over its pace.',
        triggerType: 'EVENT',
        triggerConfig: { events: ['transaction.created', 'transaction.completed'] },
        variables: { logOverPercent: 80 },
        script: `const over = budgetOverviewFilter();
function budgetOverviewFilter() {
  return budgets.filter((b) => Number(b.percentUsed) >= Number(vars.logOverPercent || 80));
}
if (!over.length) { log('Everything is on pace'); return; }
for (const budget of over) {
  log(budget.name + ' is at ' + budget.percentUsed + '% (' + budget.pace + ')');
}`,
    },
];

router.get('/templates', readLimiter, (_req, res) => {
    res.json({
        data: TEMPLATES.map((template) => ({
            ...template,
            limits: { maxPosts: MAX_POSTS_PER_RUN, timeoutMs: SCRIPT_TIMEOUT_MS, memoryBytes: MEMORY_LIMIT_BYTES },
        })),
    });
});

router.get('/settings', readLimiter, async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { automationPaused: true } });
    res.json({ data: { paused: Boolean(user?.automationPaused) } });
});

router.patch('/settings', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(z.object({ paused: z.boolean() }), req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);
    await prisma.user.update({ where: { id: req.user!.id }, data: { automationPaused: parsed.data.paused } });
    res.json({ data: { paused: parsed.data.paused } });
});

router.get('/', readLimiter, async (req: AuthRequest, res) => {
    const [automations, user] = await Promise.all([
        prisma.automation.findMany({
            where: { userId: req.user!.id, archivedAt: null },
            orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
            include: { runs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, createdAt: true } } },
        }),
        prisma.user.findUnique({ where: { id: req.user!.id }, select: { automationPaused: true } }),
    ]);
    res.json({
        data: {
            paused: Boolean(user?.automationPaused),
            automations: automations.map((row) => serialise(row, row.runs[0] ?? null)),
        },
    });
});

router.post('/', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(createSchema, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const triggerCheck = validateTrigger(parsed.data.triggerType, parsed.data.triggerConfig);
    if (!triggerCheck.ok) return badRequest(res, triggerCheck.error, 'INVALID_TRIGGER', { field: triggerCheck.field });

    const secretSource = parsed.data.triggerType === 'WEBHOOK' ? crypto.randomBytes(24).toString('base64url') : null;
    const encrypted = Object.keys(parsed.data.secrets).length ? encryptSecrets(parsed.data.secrets) : null;

    const created = await prisma.automation.create({
        data: {
            userId: req.user!.id,
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            triggerType: parsed.data.triggerType,
            triggerConfig: json(parsed.data.triggerConfig),
            script: parsed.data.script,
            variables: json(parsed.data.variables),
            encryptedSecrets: encrypted?.encryptedSecrets ?? null,
            secretsIv: encrypted?.secretsIv ?? null,
            isActive: parsed.data.isActive,
            webhookSecretHash: secretSource ? hashSecret(secretSource) : null,
            versions: {
                create: {
                    version: 1,
                    script: parsed.data.script,
                    variables: json(parsed.data.variables),
                    triggerConfig: json(parsed.data.triggerConfig),
                    createdBy: 'USER',
                },
            },
        },
    });

    res.status(201).json({ data: { ...serialise(created), webhookSecret: secretSource } });
});

router.get('/:id', readLimiter, async (req: AuthRequest, res) => {
    const automation = await prisma.automation.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
        include: {
            versions: { orderBy: { version: 'desc' }, take: 20 },
            runs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
    });
    if (!automation || automation.archivedAt) {
        return res.status(404).json({ error: 'Automation not found', code: 'AUTOMATION_NOT_FOUND' });
    }
    res.json({
        data: {
            automation: serialise(automation, automation.runs[0] ?? null),
            versions: automation.versions.map((version) => ({
                id: version.id,
                version: version.version,
                script: version.script,
                variables: version.variables,
                triggerConfig: version.triggerConfig,
                createdBy: version.createdBy,
                createdAt: version.createdAt.toISOString(),
            })),
            runs: automation.runs.map(serialiseRun),
        },
    });
});

router.patch('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(updateSchema, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const existing = await prisma.automation.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing || existing.archivedAt) {
        return res.status(404).json({ error: 'Automation not found', code: 'AUTOMATION_NOT_FOUND' });
    }

    const triggerType = parsed.data.triggerType ?? existing.triggerType;
    const triggerConfig =
        parsed.data.triggerConfig ??
        (parsed.data.triggerType ? {} : ((existing.triggerConfig ?? {}) as Record<string, unknown>));
    const triggerCheck = validateTrigger(triggerType, triggerConfig);
    if (!triggerCheck.ok) return badRequest(res, triggerCheck.error, 'INVALID_TRIGGER', { field: triggerCheck.field });

    const script = parsed.data.script ?? existing.script;
    const variables = parsed.data.variables ?? ((existing.variables ?? {}) as Record<string, string | number>);
    const contentChanged =
        parsed.data.script !== undefined ||
        parsed.data.variables !== undefined ||
        parsed.data.triggerConfig !== undefined ||
        parsed.data.triggerType !== undefined;

    const encrypted = parsed.data.secrets !== undefined ? encryptSecrets(parsed.data.secrets) : null;

    const updated = await prisma.$transaction(async (tx) => {
        if (contentChanged) {
            const latest = await tx.automationVersion.findFirst({
                where: { automationId: existing.id },
                orderBy: { version: 'desc' },
                select: { version: true },
            });
            await tx.automationVersion.create({
                data: {
                    automationId: existing.id,
                    version: (latest?.version ?? 0) + 1,
                    script,
                    variables: json(variables),
                    triggerConfig: json(triggerConfig),
                    createdBy: 'USER',
                },
            });
        }
        return tx.automation.update({
            where: { id: existing.id },
            data: {
                ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
                ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
                ...(parsed.data.triggerType !== undefined ? { triggerType } : {}),
                ...(contentChanged ? { triggerConfig: json(triggerConfig), script, variables: json(variables) } : {}),
                ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
                ...(encrypted ? { encryptedSecrets: encrypted.encryptedSecrets, secretsIv: encrypted.secretsIv } : {}),
            },
        });
    });

    res.json({ data: serialise(updated) });
});

router.delete('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const result = await prisma.automation.updateMany({
        where: { id: req.params.id, userId: req.user!.id, archivedAt: null },
        data: { isActive: false, archivedAt: new Date() },
    });
    if (!result.count) return res.status(404).json({ error: 'Automation not found', code: 'AUTOMATION_NOT_FOUND' });
    res.json({ data: { ok: true } });
});

router.post('/:id/run', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(runSchema, req.body ?? {});
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const automation = await prisma.automation.findFirst({
        where: { id: req.params.id, userId: req.user!.id, archivedAt: null },
        select: { id: true },
    });
    if (!automation) return res.status(404).json({ error: 'Automation not found', code: 'AUTOMATION_NOT_FOUND' });

    const result = await runAutomation({
        automationId: automation.id,
        userId: req.user!.id,
        trigger: parsed.data.dryRun ? 'DRY_RUN' : 'MANUAL',
        dryRun: parsed.data.dryRun ?? false,
    });
    res.json({ data: result });
});

router.get('/:id/runs', readLimiter, async (req: AuthRequest, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const automation = await prisma.automation.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
        select: { id: true },
    });
    if (!automation) return res.status(404).json({ error: 'Automation not found', code: 'AUTOMATION_NOT_FOUND' });

    const runs = await prisma.automationRun.findMany({
        where: { automationId: automation.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    res.json({ data: runs.map(serialiseRun) });
});

router.post('/:id/versions/:versionId/restore', writeLimiter, async (req: AuthRequest, res) => {
    const automation = await prisma.automation.findFirst({
        where: { id: req.params.id, userId: req.user!.id, archivedAt: null },
        select: { id: true },
    });
    if (!automation) return res.status(404).json({ error: 'Automation not found', code: 'AUTOMATION_NOT_FOUND' });

    const version = await prisma.automationVersion.findFirst({
        where: { id: req.params.versionId, automationId: automation.id },
    });
    if (!version) return res.status(404).json({ error: 'Version not found', code: 'VERSION_NOT_FOUND' });

    const newVersion = await nextVersion(automation.id);
    const restored = await prisma.$transaction(async (tx) => {
        await tx.automationVersion.create({
            data: {
                automationId: automation.id,
                version: newVersion,
                script: version.script,
                variables: version.variables ?? {},
                triggerConfig: version.triggerConfig ?? {},
                createdBy: 'RESTORE',
            },
        });
        return tx.automation.update({
            where: { id: automation.id },
            data: { script: version.script, variables: version.variables ?? {}, triggerConfig: version.triggerConfig ?? {} },
        });
    });

    res.json({ data: serialise(restored), meta: { restoredFrom: version.version, newVersion } });
});

/** Run every due schedule now instead of waiting for the worker tick. */
router.post('/sweep', writeLimiter, async (_req, res) => {
    const result = await runAutomationSweep();
    res.json({ data: result });
});

export default router;
