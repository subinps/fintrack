import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { badRequest, isoDateSchema, paiseSchema, parseBody, readLimiter, writeLimiter } from '../lib/validation';
import {
    BUDGET_TEMPLATES,
    budgetOverview,
    computeBudgetStatus,
    evaluateBudgetAlerts,
    monthlySummary,
    safeToSpend,
    type BudgetStatus,
    type ItemStatus,
} from '../services/budgets';

const router = Router();

router.use(authenticateToken);

const periodSchema = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']);
const typeSchema = z.enum(['FIXED', 'PERCENT_INCOME', 'ZERO_BASED', 'ENVELOPE']);

const itemSchema = z.object({
    name: z.string().trim().min(1).max(80).nullish(),
    accountId: z.coerce.number().int().positive().nullish(),
    tag: z.string().trim().min(1).max(40).nullish(),
    amountPaise: paiseSchema.optional(),
    percent: z.number().min(0).max(100).nullish(),
    parentId: z.string().uuid().nullish(),
    alertAt: z.array(z.number().int().min(1).max(200)).max(6).optional(),
});

const budgetFields = {
    name: z.string().trim().min(1).max(80),
    period: periodSchema.default('MONTHLY'),
    type: typeSchema.default('FIXED'),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullish(),
    rollover: z.boolean().optional(),
    rolloverCapPaise: paiseSchema.nullish(),
    notes: z.string().trim().max(500).nullish(),
    items: z.array(itemSchema).max(100).optional(),
};

const createBudgetSchema = z.object(budgetFields).refine((value) => value.period !== 'CUSTOM' || Boolean(value.endDate), {
    message: 'A custom budget needs an end date',
    path: ['endDate'],
});

const updateBudgetSchema = z
    .object({
        name: budgetFields.name.optional(),
        period: periodSchema.optional(),
        type: typeSchema.optional(),
        startDate: isoDateSchema.optional(),
        endDate: isoDateSchema.nullish(),
        rollover: z.boolean().optional(),
        rolloverCapPaise: paiseSchema.nullish(),
        notes: z.string().trim().max(500).nullish(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const serialiseItem = (item: ItemStatus): Record<string, unknown> => ({
    ...item,
    amountPaise: item.amountPaise.toString(),
    limitPaise: item.limitPaise.toString(),
    spentPaise: item.spentPaise.toString(),
    rolloverPaise: item.rolloverPaise.toString(),
    remainingPaise: item.remainingPaise.toString(),
    dailyAllowancePaise: item.dailyAllowancePaise.toString(),
    projectedSpendPaise: item.projectedSpendPaise.toString(),
    upcomingPaise: item.upcomingPaise.toString(),
    children: item.children.map(serialiseItem),
});

export const serialiseBudgetStatus = (status: BudgetStatus): Record<string, unknown> => ({
    ...status,
    startDate: status.startDate.toISOString(),
    endDate: status.endDate ? status.endDate.toISOString() : null,
    periodStart: status.periodStart.toISOString(),
    periodEnd: status.periodEnd.toISOString(),
    totalLimitPaise: status.totalLimitPaise.toString(),
    totalSpentPaise: status.totalSpentPaise.toString(),
    totalRemainingPaise: status.totalRemainingPaise.toString(),
    rolloverCapPaise: status.rolloverCapPaise?.toString() ?? null,
    rolloverPaise: status.rolloverPaise.toString(),
    incomePaise: status.incomePaise.toString(),
    unallocatedPaise: status.unallocatedPaise?.toString() ?? null,
    projectedOverspendPaise: status.projectedOverspendPaise.toString(),
    items: status.items.map(serialiseItem),
});

function itemsData(items: z.infer<typeof itemSchema>[] | undefined) {
    return (items ?? []).map((item) => ({
        name: item.name ?? null,
        accountId: item.accountId ?? null,
        tag: item.tag ?? null,
        amountPaise: BigInt(item.amountPaise ?? '0'),
        percent: item.percent ?? null,
        parentId: item.parentId ?? null,
        alertAt: item.alertAt ?? [50, 80, 100],
    }));
}

async function assertAccountsOwned(userId: string, items: z.infer<typeof itemSchema>[] | undefined) {
    const accountIds = Array.from(new Set((items ?? []).map((item) => item.accountId).filter((id): id is number => Boolean(id))));
    if (accountIds.length === 0) return true;
    const owned = await prisma.account.count({ where: { userId, id: { in: accountIds } } });
    return owned === accountIds.length;
}

async function findBudget(userId: string, id: string) {
    return prisma.budget.findFirst({ where: { id, userId, deletedAt: null }, include: { items: true } });
}

async function freshStatus(userId: string, budgetId: string) {
    const fresh = await findBudget(userId, budgetId);
    if (!fresh) throw new Error('Budget disappeared while updating');
    return serialiseBudgetStatus(await computeBudgetStatus(userId, fresh));
}

router.get('/', readLimiter, async (req: AuthRequest, res) => {
    const budgets = await budgetOverview(req.user!.id);
    res.json({ data: budgets.map(serialiseBudgetStatus) });
});

router.get('/templates', readLimiter, (_req, res) => {
    res.json({ data: BUDGET_TEMPLATES });
});

router.get('/summary', readLimiter, async (req: AuthRequest, res) => {
    const summary = await monthlySummary(req.user!.id);
    res.json({
        data: {
            ...summary,
            incomePaise: summary.incomePaise.toString(),
            expensePaise: summary.expensePaise.toString(),
            savingsPaise: summary.savingsPaise.toString(),
            previousExpensePaise: summary.previousExpensePaise.toString(),
            topCategories: summary.topCategories.map((entry) => ({ ...entry, spentPaise: entry.spentPaise.toString() })),
            unbudgeted: summary.unbudgeted.map((entry) => ({ ...entry, spentPaise: entry.spentPaise.toString() })),
        },
    });
});

router.get('/safe-to-spend', readLimiter, async (req: AuthRequest, res) => {
    const days = Math.min(180, Math.max(1, Number(req.query.days ?? 30) || 30));
    const result = await safeToSpend(req.user!.id, days);
    res.json({
        data: {
            liquidPaise: result.liquidPaise.toString(),
            reservedBudgetPaise: result.reservedBudgetPaise.toString(),
            upcomingBillsPaise: result.upcomingBillsPaise.toString(),
            debtDuesPaise: result.debtDuesPaise.toString(),
            safeToSpendPaise: result.safeToSpendPaise.toString(),
            horizonDays: result.horizonDays,
        },
    });
});

router.get('/alerts', readLimiter, async (req: AuthRequest, res) => {
    const alerts = await prisma.budgetAlertLog.findMany({
        where: { item: { budget: { userId: req.user!.id } } },
        include: { item: { select: { name: true, budget: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({
        data: alerts.map((alert) => ({
            id: alert.id,
            itemId: alert.itemId,
            itemName: alert.item.name,
            budgetName: alert.item.budget.name,
            threshold: alert.threshold,
            periodStart: alert.periodStart.toISOString(),
            createdAt: alert.createdAt.toISOString(),
        })),
    });
});

router.post('/', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(createBudgetSchema, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);
    if (!(await assertAccountsOwned(req.user!.id, parsed.data.items))) return badRequest(res, 'One of the accounts does not belong to you', 'ACCOUNT_NOT_FOUND');

    const created = await prisma.budget.create({
        data: {
            userId: req.user!.id,
            name: parsed.data.name,
            period: parsed.data.period,
            type: parsed.data.type,
            startDate: new Date(parsed.data.startDate),
            endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
            rollover: parsed.data.rollover ?? false,
            rolloverCapPaise: parsed.data.rolloverCapPaise != null ? BigInt(parsed.data.rolloverCapPaise) : null,
            notes: parsed.data.notes ?? null,
            items: { create: itemsData(parsed.data.items) },
        },
        include: { items: true },
    });

    const status = await computeBudgetStatus(req.user!.id, created);
    res.status(201).json({ data: serialiseBudgetStatus(status) });
});

router.post('/from-template', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(
        z.object({
            templateId: z.string().min(1),
            name: z.string().trim().min(1).max(80).optional(),
            startDate: isoDateSchema.optional(),
        }),
        req.body
    );
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const template = BUDGET_TEMPLATES.find((entry) => entry.id === parsed.data.templateId);
    if (!template) return badRequest(res, 'Unknown budget template', 'TEMPLATE_NOT_FOUND');

    const created = await prisma.budget.create({
        data: {
            userId: req.user!.id,
            name: parsed.data.name ?? template.name,
            period: 'MONTHLY',
            type: template.type,
            startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : new Date(),
            items: {
                create: template.items.map((item) => ({
                    name: item.name,
                    percent: item.percent,
                    amountPaise: 0n,
                    alertAt: [50, 80, 100],
                })),
            },
        },
        include: { items: true },
    });

    res.status(201).json({ data: serialiseBudgetStatus(await computeBudgetStatus(req.user!.id, created)) });
});

router.get('/:id', readLimiter, async (req: AuthRequest, res) => {
    const budget = await findBudget(req.user!.id, req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found', code: 'BUDGET_NOT_FOUND' });
    res.json({ data: serialiseBudgetStatus(await computeBudgetStatus(req.user!.id, budget)) });
});

router.patch('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(updateBudgetSchema, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const budget = await findBudget(req.user!.id, req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found', code: 'BUDGET_NOT_FOUND' });

    const nextPeriod = parsed.data.period ?? (budget.period as 'MONTHLY');
    const nextEnd = parsed.data.endDate !== undefined ? parsed.data.endDate : budget.endDate;
    if (nextPeriod === 'CUSTOM' && !nextEnd) return badRequest(res, 'A custom budget needs an end date', 'VALIDATION_ERROR');

    const updated = await prisma.budget.update({
        where: { id: budget.id },
        data: {
            name: parsed.data.name ?? undefined,
            period: parsed.data.period ?? undefined,
            type: parsed.data.type ?? undefined,
            startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
            endDate: parsed.data.endDate === null ? null : parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
            rollover: parsed.data.rollover ?? undefined,
            rolloverCapPaise:
                parsed.data.rolloverCapPaise === null
                    ? null
                    : parsed.data.rolloverCapPaise != null
                        ? BigInt(parsed.data.rolloverCapPaise)
                        : undefined,
            notes: parsed.data.notes === null ? null : parsed.data.notes ?? undefined,
        },
        include: { items: true },
    });

    res.json({ data: serialiseBudgetStatus(await computeBudgetStatus(req.user!.id, updated)) });
});

router.delete('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const budget = await findBudget(req.user!.id, req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found', code: 'BUDGET_NOT_FOUND' });
    await prisma.budget.update({ where: { id: budget.id }, data: { deletedAt: new Date() } });
    res.json({ data: { ok: true } });
});

router.post('/:id/items', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(itemSchema, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const budget = await findBudget(req.user!.id, req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found', code: 'BUDGET_NOT_FOUND' });
    if (!(await assertAccountsOwned(req.user!.id, [parsed.data]))) return badRequest(res, 'That account does not belong to you', 'ACCOUNT_NOT_FOUND');
    if (parsed.data.parentId && !budget.items.some((item) => item.id === parsed.data.parentId)) {
        return badRequest(res, 'Parent category must belong to the same budget', 'PARENT_NOT_FOUND');
    }

    await prisma.budgetItem.create({ data: { budgetId: budget.id, ...itemsData([parsed.data])[0] } });
    res.status(201).json({ data: await freshStatus(req.user!.id, budget.id) });
});

router.patch('/:id/items/:itemId', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(itemSchema.partial(), req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const budget = await findBudget(req.user!.id, req.params.id);
    const item = budget?.items.find((entry) => entry.id === req.params.itemId);
    if (!budget || !item) return res.status(404).json({ error: 'Budget category not found', code: 'ITEM_NOT_FOUND' });
    if (parsed.data.accountId !== undefined && !(await assertAccountsOwned(req.user!.id, [parsed.data as z.infer<typeof itemSchema>]))) {
        return badRequest(res, 'That account does not belong to you', 'ACCOUNT_NOT_FOUND');
    }
    if (parsed.data.parentId && (parsed.data.parentId === item.id || !budget.items.some((entry) => entry.id === parsed.data.parentId))) {
        return badRequest(res, 'Parent category must belong to the same budget', 'PARENT_NOT_FOUND');
    }

    await prisma.budgetItem.update({
        where: { id: item.id },
        data: {
            name: parsed.data.name === undefined ? undefined : parsed.data.name,
            accountId: parsed.data.accountId === undefined ? undefined : parsed.data.accountId,
            tag: parsed.data.tag === undefined ? undefined : parsed.data.tag,
            amountPaise: parsed.data.amountPaise === undefined ? undefined : BigInt(parsed.data.amountPaise),
            percent: parsed.data.percent === undefined ? undefined : parsed.data.percent,
            parentId: parsed.data.parentId === undefined ? undefined : parsed.data.parentId,
            alertAt: parsed.data.alertAt ?? undefined,
        },
    });

    res.json({ data: await freshStatus(req.user!.id, budget.id) });
});

router.delete('/:id/items/:itemId', writeLimiter, async (req: AuthRequest, res) => {
    const budget = await findBudget(req.user!.id, req.params.id);
    const item = budget?.items.find((entry) => entry.id === req.params.itemId);
    if (!budget || !item) return res.status(404).json({ error: 'Budget category not found', code: 'ITEM_NOT_FOUND' });

    await prisma.budgetItem.delete({ where: { id: item.id } });
    res.json({ data: await freshStatus(req.user!.id, budget.id) });
});

router.post('/:id/items/copy', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(z.object({ fromBudgetId: z.string().uuid() }), req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const target = await findBudget(req.user!.id, req.params.id);
    if (!target) return res.status(404).json({ error: 'Budget not found', code: 'BUDGET_NOT_FOUND' });
    const source = await findBudget(req.user!.id, parsed.data.fromBudgetId);
    if (!source) return res.status(404).json({ error: 'Source budget not found', code: 'BUDGET_NOT_FOUND' });
    if (source.id === target.id) return badRequest(res, 'Pick a different budget to copy from', 'INVALID_SOURCE');

    const idMap = new Map<string, string>();
    for (const item of source.items) {
        const created = await prisma.budgetItem.create({
            data: {
                budgetId: target.id,
                name: item.name,
                accountId: item.accountId,
                tag: item.tag,
                amountPaise: item.amountPaise,
                percent: item.percent,
                alertAt: item.alertAt,
            },
            select: { id: true },
        });
        idMap.set(item.id, created.id);
    }
    for (const item of source.items) {
        if (!item.parentId) continue;
        const newParent = idMap.get(item.parentId);
        const newId = idMap.get(item.id);
        if (newParent && newId) await prisma.budgetItem.update({ where: { id: newId }, data: { parentId: newParent } });
    }

    res.status(201).json({ data: await freshStatus(req.user!.id, target.id) });
});

router.post('/:id/check-alerts', writeLimiter, async (req: AuthRequest, res) => {
    const budget = await findBudget(req.user!.id, req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found', code: 'BUDGET_NOT_FOUND' });
    const sent = await evaluateBudgetAlerts(req.user!.id);
    res.json({ data: { sent } });
});

export default router;
