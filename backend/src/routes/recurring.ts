import { Router } from 'express';
import { z } from 'zod';
import { RRule } from 'rrule';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { badRequest, parseBody, readLimiter, writeLimiter } from '../lib/validation';
import { LedgerError, assertOwnedAccounts } from '../services/ledger';
import {
    addDays,
    applyWeekendPolicy,
    cashFlowForecast,
    dayKey,
    dueDatesForRule,
    nextDueAfter,
    parseDay,
    processRecurringRule,
    suggestRecurring,
    templateFromTransaction,
    todayInZone,
    updateOccurrence,
    type WeekendPolicy,
} from '../services/recurring';
import { logger } from '../lib/logger';

const router = Router();

const templateSchema = z.object({
    description: z.string().trim().min(1).max(200),
    lines: z
        .array(
            z.object({
                accountId: z.coerce.number().int().positive(),
                amountPaise: z.union([z.string(), z.number()]).transform((value) => String(value)),
                units: z.union([z.string(), z.number()]).nullish(),
            })
        )
        .min(2, 'A recurring entry needs at least two splits'),
});

const formulaSchema = z
    .object({
        kind: z.literal('PERCENT_OF_BALANCE'),
        accountId: z.coerce.number().int().positive(),
        percent: z.coerce.number().min(0.01).max(100),
        minPaise: z.union([z.string(), z.number()]).optional(),
        maxPaise: z.union([z.string(), z.number()]).optional(),
    })
    .nullish();

const ruleBody = z.object({
    name: z.string().trim().min(1).max(120),
    template: templateSchema,
    rrule: z.string().trim().min(3),
    timezone: z.string().trim().min(1).max(64).optional(),
    startDate: z.string().min(4),
    endDate: z.string().nullish(),
    maxRuns: z.coerce.number().int().positive().max(10000).nullish(),
    mode: z.enum(['AUTO_POST', 'CONFIRM']).default('AUTO_POST'),
    catchUp: z.enum(['ALL', 'LATEST', 'SKIP']).default('ALL'),
    weekendPolicy: z.enum(['SAME', 'PREV_BUSINESS', 'NEXT_BUSINESS']).default('SAME'),
    amountMode: z.enum(['FIXED', 'ASK', 'FORMULA']).default('FIXED'),
    formula: formulaSchema,
    remindDaysBefore: z.coerce.number().int().min(0).max(60).default(0),
});

const validateTemplate = (template: z.infer<typeof templateSchema>) => {
    if (template.lines.some((line) => !/^-?\d+$/.test(String(line.amountPaise)))) {
        return 'Amounts must be integer paise';
    }
    const total = template.lines.reduce((sum, line) => sum + BigInt(line.amountPaise), 0n);
    if (total !== 0n) return 'Splits must sum to zero: debits and credits have to match';
    if (template.lines.every((line) => BigInt(line.amountPaise) === 0n)) return 'Amounts cannot all be zero';
    return null;
};

const validateRule = (value: z.infer<typeof ruleBody>) => {
    const templateError = validateTemplate(value.template);
    if (templateError) return templateError;
    try {
        const parsed = RRule.parseString(value.rrule.replace(/^RRULE:/i, ''));
        if (!parsed.freq) return 'rrule must include FREQ';
    } catch {
        return 'That repeat rule is not valid';
    }
    if (Number.isNaN(parseDay(value.startDate).getTime())) return 'startDate is not a valid date';
    if (value.endDate && parseDay(value.endDate) < parseDay(value.startDate)) return 'endDate must be after startDate';
    if (value.amountMode === 'FORMULA' && !value.formula) return 'A formula amount mode needs a formula';
    return null;
};

const ruleToJson = (rule: {
    id: string;
    name: string;
    rrule: string;
    timezone: string;
    startDate: Date;
    endDate: Date | null;
    maxRuns: number | null;
    mode: string;
    catchUp: string;
    weekendPolicy: string;
    amountMode: string;
    formula: string | null;
    nextRunAt: Date;
    isActive: boolean;
    remindDaysBefore: number;
    runCount: number;
    lastRunAt: Date | null;
    template: unknown;
    createdAt: Date;
    updatedAt: Date;
}) => ({
    ...rule,
    startDate: dayKey(rule.startDate),
    endDate: rule.endDate ? dayKey(rule.endDate) : null,
    nextRunAt: dayKey(rule.nextRunAt),
    lastRunAt: rule.lastRunAt?.toISOString() ?? null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
    formula: rule.formula ? JSON.parse(rule.formula) : null,
});

router.use(authenticateToken);

router.get('/', readLimiter, async (req: AuthRequest, res) => {
    const rules = await prisma.recurringRule.findMany({
        where: { userId: req.user!.id, deletedAt: null },
        orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });
    const today = todayInZone('Asia/Kolkata');
    const upcoming: Record<string, { dueDate: string; status: string }[]> = {};
    for (const rule of rules) {
        const dates = dueDatesForRule(rule, addDays(today, -1), addDays(today, 90)).slice(0, 5);
        upcoming[rule.id] = dates.map((date) => ({
            dueDate: dayKey(applyWeekendPolicy(date, rule.weekendPolicy as WeekendPolicy)),
            status: 'SCHEDULED',
        }));
    }
    res.json({ data: rules.map(ruleToJson), upcoming });
});

router.get('/forecast', readLimiter, async (req: AuthRequest, res) => {
    const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 7), 180);
    res.json({ data: await cashFlowForecast(req.user!.id, days) });
});

router.get('/suggestions', readLimiter, async (req: AuthRequest, res) => {
    res.json({ data: await suggestRecurring(req.user!.id) });
});

router.post('/preview', readLimiter, (req: AuthRequest, res) => {
    const parsed = parseBody(ruleBody.partial().required({ rrule: true, startDate: true }), req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);
    const start = parseDay(parsed.data.startDate);
    const from = addDays(start, -1);
    const dates = dueDatesForRule(
        { rrule: parsed.data.rrule, startDate: start, endDate: parsed.data.endDate ? parseDay(parsed.data.endDate) : null },
        new Date(Math.max(from.getTime(), Date.now())),
        addDays(new Date(), 400),
        8
    );
    const policy = (parsed.data.weekendPolicy ?? 'SAME') as WeekendPolicy;
    res.json({ data: dates.map((date) => dayKey(applyWeekendPolicy(date, policy))) });
});

router.post('/', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(ruleBody, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);
    const error = validateRule(parsed.data);
    if (error) return badRequest(res, error);

    await assertOwnedAccounts(req.user!.id, parsed.data.template.lines.map((line) => line.accountId));

    const startDate = parseDay(parsed.data.startDate);
    const endDate = parsed.data.endDate ? parseDay(parsed.data.endDate) : null;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { timezone: true } });
    const timezone = parsed.data.timezone ?? user?.timezone ?? 'Asia/Kolkata';

    const base = { rrule: parsed.data.rrule.replace(/^RRULE:/i, ''), startDate, endDate };
    const today = todayInZone(timezone);
    const nextRunAt = dueDatesForRule(base, today, addDays(today, 366 * 3), 1)[0] ?? startDate;

    const rule = await prisma.recurringRule.create({
        data: {
            userId: req.user!.id,
            name: parsed.data.name,
            template: parsed.data.template as unknown as object,
            rrule: base.rrule,
            timezone,
            startDate,
            endDate,
            maxRuns: parsed.data.maxRuns ?? null,
            mode: parsed.data.mode,
            catchUp: parsed.data.catchUp,
            weekendPolicy: parsed.data.weekendPolicy,
            amountMode: parsed.data.amountMode,
            formula: parsed.data.formula ? JSON.stringify(parsed.data.formula) : null,
            nextRunAt,
            remindDaysBefore: parsed.data.remindDaysBefore,
        },
    });

    logger.info({ ruleId: rule.id, userId: req.user!.id }, 'recurring rule created');
    res.status(201).json({ data: ruleToJson(rule) });
});

router.post('/from-transaction/:transactionId', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(
        z.object({
            name: z.string().trim().min(1).max(120),
            rrule: z.string().default('FREQ=MONTHLY;INTERVAL=1'),
            mode: z.enum(['AUTO_POST', 'CONFIRM']).default('CONFIRM'),
            startDate: z.string().optional(),
            catchUp: z.enum(['ALL', 'LATEST', 'SKIP']).default('ALL'),
            weekendPolicy: z.enum(['SAME', 'PREV_BUSINESS', 'NEXT_BUSINESS']).default('SAME'),
            remindDaysBefore: z.coerce.number().int().min(0).max(60).default(0),
        }),
        req.body
    );
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const transaction = await prisma.transaction.findFirst({
        where: { id: Number(req.params.transactionId), userId: req.user!.id, status: { not: 'VOIDED' } },
        include: { splits: true },
    });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });

    const template = templateFromTransaction(transaction);
    const startDate = parsed.data.startDate ? parseDay(parsed.data.startDate) : parseDay(transaction.date);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { timezone: true } });
    const timezone = user?.timezone ?? 'Asia/Kolkata';
    const base = { rrule: parsed.data.rrule.replace(/^RRULE:/i, ''), startDate, endDate: null };
    const today = todayInZone(timezone);
    const next = dueDatesForRule(base, addDays(today, -1), addDays(today, 366 * 3), 1)[0] ?? startDate;

    const rule = await prisma.recurringRule.create({
        data: {
            userId: req.user!.id,
            name: parsed.data.name,
            template: template as unknown as object,
            rrule: base.rrule,
            timezone,
            startDate,
            mode: parsed.data.mode,
            catchUp: parsed.data.catchUp,
            weekendPolicy: parsed.data.weekendPolicy,
            remindDaysBefore: parsed.data.remindDaysBefore,
            nextRunAt: next,
        },
    });
    res.status(201).json({ data: ruleToJson(rule) });
});

router.get('/:id', readLimiter, async (req: AuthRequest, res) => {
    const rule = await prisma.recurringRule.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
        include: { occurrences: { orderBy: { dueDate: 'desc' }, take: 100 } },
    });
    if (!rule) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });
    res.json({
        data: {
            ...ruleToJson(rule),
            occurrences: rule.occurrences.map((occurrence) => ({
                id: occurrence.id,
                dueDate: dayKey(occurrence.dueDate),
                status: occurrence.status,
                transactionId: occurrence.transactionId,
                amountPaise: occurrence.amountPaise?.toString() ?? null,
                note: occurrence.note,
                error: occurrence.error,
                postedAt: occurrence.postedAt?.toISOString() ?? null,
            })),
        },
    });
});

router.patch('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(
        z.object({
            name: z.string().trim().min(1).max(120).optional(),
            template: templateSchema.optional(),
            rrule: z.string().trim().min(3).optional(),
            timezone: z.string().trim().min(1).max(64).optional(),
            startDate: z.string().optional(),
            endDate: z.string().nullish(),
            maxRuns: z.coerce.number().int().positive().max(10000).nullish(),
            mode: z.enum(['AUTO_POST', 'CONFIRM']).optional(),
            catchUp: z.enum(['ALL', 'LATEST', 'SKIP']).optional(),
            weekendPolicy: z.enum(['SAME', 'PREV_BUSINESS', 'NEXT_BUSINESS']).optional(),
            amountMode: z.enum(['FIXED', 'ASK', 'FORMULA']).optional(),
            formula: formulaSchema,
            remindDaysBefore: z.coerce.number().int().min(0).max(60).optional(),
            applyTo: z.enum(['FUTURE', 'ALL']).default('FUTURE'),
        }),
        req.body
    );
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const existing = await prisma.recurringRule.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });

    if (parsed.data.template) {
        const templateError = validateTemplate(parsed.data.template);
        if (templateError) return badRequest(res, templateError);
        await assertOwnedAccounts(req.user!.id, parsed.data.template.lines.map((line) => line.accountId));
    }
    if (parsed.data.rrule) {
        try {
            RRule.parseString(parsed.data.rrule.replace(/^RRULE:/i, ''));
        } catch {
            return badRequest(res, 'That repeat rule is not valid');
        }
    }

    const rrule = (parsed.data.rrule ?? existing.rrule).replace(/^RRULE:/i, '');
    const startDate = parsed.data.startDate ? parseDay(parsed.data.startDate) : existing.startDate;
    const endDate = parsed.data.endDate === undefined ? existing.endDate : parsed.data.endDate ? parseDay(parsed.data.endDate) : null;
    const today = todayInZone(parsed.data.timezone ?? existing.timezone);
    const scheduleChanged =
        rrule !== existing.rrule ||
        startDate.getTime() !== existing.startDate.getTime() ||
        (endDate?.getTime() ?? null) !== (existing.endDate?.getTime() ?? null);
    const nextRunAt = scheduleChanged
        ? dueDatesForRule({ rrule, startDate, endDate }, today, addDays(today, 366 * 3), 1)[0] ?? addDays(today, 1)
        : existing.nextRunAt;

    const rule = await prisma.recurringRule.update({
        where: { id: existing.id },
        data: {
            name: parsed.data.name ?? undefined,
            template: parsed.data.template ? (parsed.data.template as unknown as object) : undefined,
            rrule,
            timezone: parsed.data.timezone ?? undefined,
            startDate,
            endDate,
            maxRuns: parsed.data.maxRuns === undefined ? undefined : parsed.data.maxRuns,
            mode: parsed.data.mode ?? undefined,
            catchUp: parsed.data.catchUp ?? undefined,
            weekendPolicy: parsed.data.weekendPolicy ?? undefined,
            amountMode: parsed.data.amountMode ?? undefined,
            formula: parsed.data.formula === undefined ? undefined : parsed.data.formula ? JSON.stringify(parsed.data.formula) : null,
            remindDaysBefore: parsed.data.remindDaysBefore ?? undefined,
            nextRunAt,
        },
    });
    res.json({ data: ruleToJson(rule) });
});

router.delete('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const existing = await prisma.recurringRule.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });
    await prisma.recurringRule.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), isActive: false },
    });
    res.json({ message: 'Recurring rule removed' });
});

router.post('/:id/pause', writeLimiter, async (req: AuthRequest, res) => {
    const result = await prisma.recurringRule.updateMany({
        where: { id: req.params.id, userId: req.user!.id, deletedAt: null },
        data: { isActive: false },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });
    res.json({ message: 'Paused', isActive: false });
});

router.post('/:id/resume', writeLimiter, async (req: AuthRequest, res) => {
    const rule = await prisma.recurringRule.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!rule) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });
    const today = todayInZone(rule.timezone);
    const next = nextDueAfter(rule, today) ?? rule.nextRunAt;
    await prisma.recurringRule.update({ where: { id: rule.id }, data: { isActive: true, nextRunAt: next } });
    res.json({ message: 'Resumed', isActive: true, nextRunAt: dayKey(next) });
});

router.post('/:id/skip-next', writeLimiter, async (req: AuthRequest, res) => {
    const rule = await prisma.recurringRule.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!rule) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });
    const dueDate = applyWeekendPolicy(rule.nextRunAt, rule.weekendPolicy as WeekendPolicy);
    await prisma.recurringOccurrence.upsert({
        where: { ruleId_dueDate: { ruleId: rule.id, dueDate } },
        create: { ruleId: rule.id, dueDate, status: 'SKIPPED', note: 'Skipped by user' },
        update: { status: 'SKIPPED', note: 'Skipped by user' },
    });
    const next = nextDueAfter(rule, rule.nextRunAt);
    await prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRunAt: next ?? rule.nextRunAt } });
    res.json({ message: 'Next occurrence skipped', nextRunAt: next ? dayKey(next) : null });
});

router.post('/:id/run-now', writeLimiter, async (req: AuthRequest, res) => {
    const rule = await prisma.recurringRule.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!rule) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });
    const result = await processRecurringRule(rule.id, { now: new Date(Date.now() + 1000) });
    res.json({ data: result });
});

router.get('/:id/occurrences', readLimiter, async (req: AuthRequest, res) => {
    const rule = await prisma.recurringRule.findFirst({ where: { id: req.params.id, userId: req.user!.id }, select: { id: true } });
    if (!rule) return res.status(404).json({ error: 'Recurring rule not found', code: 'RULE_NOT_FOUND' });
    const occurrences = await prisma.recurringOccurrence.findMany({
        where: { ruleId: rule.id },
        orderBy: { dueDate: 'desc' },
        take: 200,
    });
    res.json({
        data: occurrences.map((occurrence) => ({
            ...occurrence,
            dueDate: dayKey(occurrence.dueDate),
            amountPaise: occurrence.amountPaise?.toString() ?? null,
            postedAt: occurrence.postedAt?.toISOString() ?? null,
            createdAt: occurrence.createdAt.toISOString(),
        })),
    });
});

router.patch('/occurrences/:occurrenceId', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(
        z.object({
            skip: z.boolean().optional(),
            date: z.string().optional(),
            lines: z
                .array(
                    z.object({
                        accountId: z.coerce.number().int().positive(),
                        amountPaise: z.union([z.string(), z.number()]).transform((value) => String(value)),
                        units: z.union([z.string(), z.number()]).nullish(),
                    })
                )
                .min(2)
                .optional(),
        }),
        req.body
    );
    if (!parsed.ok) return res.status(400).json(parsed.error);

    let lines;
    if (parsed.data.lines) {
        const total = parsed.data.lines.reduce((sum, line) => sum + BigInt(line.amountPaise), 0n);
        if (total !== 0n) return badRequest(res, 'Splits must sum to zero');
        await assertOwnedAccounts(req.user!.id, parsed.data.lines.map((line) => line.accountId));
        lines = parsed.data.lines.map((line) => ({
            accountId: line.accountId,
            amount: BigInt(line.amountPaise),
            units: line.units ?? undefined,
        }));
    }

    try {
        const result = await updateOccurrence(req.user!.id, req.params.occurrenceId, {
            lines,
            date: parsed.data.date ? parseDay(parsed.data.date) : undefined,
            skip: parsed.data.skip,
        });
        res.json({ data: result });
    } catch (error) {
        if (error instanceof LedgerError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
        throw error;
    }
});

export default router;
