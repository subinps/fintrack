import { Router } from 'express';
import { z } from 'zod';
import { RRule } from 'rrule';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { badRequest, isoDateSchema, paiseSchema, parseBody, readLimiter, writeLimiter } from '../lib/validation';
import { postTransaction } from '../services/ledger';
import { goalList, goalProgress, type GoalProgress } from '../services/goals';
import { startOfUtcDay } from '../services/recurring';

const router = Router();

router.use(authenticateToken);

const serialiseGoal = (goal: GoalProgress): Record<string, unknown> => ({
    ...goal,
    targetAmount: goal.targetAmount.toString(),
    savedPaise: goal.savedPaise.toString(),
    progressPaise: goal.progressPaise.toString(),
    remainingPaise: goal.remainingPaise.toString(),
    requiredMonthlyPaise: goal.requiredMonthlyPaise?.toString() ?? null,
    targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
    createdAt: goal.createdAt.toISOString(),
});

const goalSchema = z.object({
    name: z.string().trim().min(1).max(80),
    targetAmountPaise: paiseSchema,
    targetDate: isoDateSchema.nullish(),
    linkedAccountId: z.coerce.number().int().positive().nullish(),
    notes: z.string().trim().max(500).nullish(),
});

async function findGoal(userId: string, id: string) {
    return prisma.goal.findFirst({ where: { id, userId, archivedAt: null } });
}

router.get('/', readLimiter, async (req: AuthRequest, res) => {
    const goals = await goalList(req.user!.id);
    res.json({ data: goals.map(serialiseGoal) });
});

router.get('/:id', readLimiter, async (req: AuthRequest, res) => {
    const goal = await findGoal(req.user!.id, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'GOAL_NOT_FOUND' });
    res.json({ data: serialiseGoal(await goalProgress(goal)) });
});

router.post('/', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(goalSchema, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    if (parsed.data.linkedAccountId) {
        const account = await prisma.account.count({ where: { id: parsed.data.linkedAccountId, userId: req.user!.id } });
        if (!account) return badRequest(res, 'That account does not belong to you', 'ACCOUNT_NOT_FOUND');
    }

    const goal = await prisma.goal.create({
        data: {
            userId: req.user!.id,
            name: parsed.data.name,
            targetAmount: BigInt(parsed.data.targetAmountPaise),
            targetDate: parsed.data.targetDate ? startOfUtcDay(new Date(parsed.data.targetDate)) : null,
            linkedAccountId: parsed.data.linkedAccountId ?? null,
            notes: parsed.data.notes ?? null,
        },
    });

    res.status(201).json({ data: serialiseGoal(await goalProgress(goal)) });
});

router.patch('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(goalSchema.partial(), req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const goal = await findGoal(req.user!.id, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'GOAL_NOT_FOUND' });
    if (parsed.data.linkedAccountId) {
        const account = await prisma.account.count({ where: { id: parsed.data.linkedAccountId, userId: req.user!.id } });
        if (!account) return badRequest(res, 'That account does not belong to you', 'ACCOUNT_NOT_FOUND');
    }

    const updated = await prisma.goal.update({
        where: { id: goal.id },
        data: {
            name: parsed.data.name ?? undefined,
            targetAmount: parsed.data.targetAmountPaise ? BigInt(parsed.data.targetAmountPaise) : undefined,
            targetDate:
                parsed.data.targetDate === null
                    ? null
                    : parsed.data.targetDate
                        ? startOfUtcDay(new Date(parsed.data.targetDate))
                        : undefined,
            linkedAccountId: parsed.data.linkedAccountId === undefined ? undefined : parsed.data.linkedAccountId,
            notes: parsed.data.notes === null ? null : parsed.data.notes ?? undefined,
        },
    });

    res.json({ data: serialiseGoal(await goalProgress(updated)) });
});

router.delete('/:id', writeLimiter, async (req: AuthRequest, res) => {
    const goal = await findGoal(req.user!.id, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'GOAL_NOT_FOUND' });
    await prisma.goal.update({ where: { id: goal.id }, data: { archivedAt: new Date() } });
    if (goal.recurringRuleId) {
        await prisma.recurringRule.update({ where: { id: goal.recurringRuleId }, data: { isActive: false } }).catch(() => null);
    }
    res.json({ data: { ok: true } });
});

router.post('/:id/contribute', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(
        z.object({ amountPaise: paiseSchema, fromAccountId: z.coerce.number().int().positive().nullish(), date: isoDateSchema.optional() }),
        req.body
    );
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const goal = await findGoal(req.user!.id, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'GOAL_NOT_FOUND' });

    const amount = BigInt(parsed.data.amountPaise);
    if (amount <= 0n) return badRequest(res, 'A contribution must be more than zero');

    if (!goal.linkedAccountId) {
        const updated = await prisma.goal.update({
            where: { id: goal.id },
            data: { savedPaise: { increment: amount } },
        });
        return res.json({ data: serialiseGoal(await goalProgress(updated)) });
    }

    if (!parsed.data.fromAccountId) return badRequest(res, 'Choose the account the money comes from');
    if (parsed.data.fromAccountId === goal.linkedAccountId) return badRequest(res, 'Choose a different account to contribute from');

    try {
        await postTransaction({
            userId: req.user!.id,
            description: `Goal · ${goal.name}`,
            date: parsed.data.date ? startOfUtcDay(new Date(parsed.data.date)) : startOfUtcDay(new Date()),
            source: 'MANUAL',
            lines: [
                { accountId: goal.linkedAccountId, amount },
                { accountId: parsed.data.fromAccountId, amount: -amount },
            ],
        });
    } catch (error) {
        const status = (error as { statusCode?: number }).statusCode ?? 400;
        return res.status(status).json({ error: (error as Error).message, code: 'GOAL_CONTRIBUTION_FAILED' });
    }

    res.json({ data: serialiseGoal(await goalProgress(goal)) });
});

router.post('/:id/auto-contribute', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(
        z.object({
            amountPaise: paiseSchema,
            dayOfMonth: z.coerce.number().int().min(1).max(28),
            fromAccountId: z.coerce.number().int().positive(),
        }),
        req.body
    );
    if (!parsed.ok) return res.status(400).json(parsed.error);

    const goal = await findGoal(req.user!.id, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'GOAL_NOT_FOUND' });
    if (!goal.linkedAccountId) return badRequest(res, 'Link a savings account before scheduling contributions', 'GOAL_NO_ACCOUNT');

    const amount = BigInt(parsed.data.amountPaise);
    if (amount <= 0n) return badRequest(res, 'A contribution must be more than zero');
    if (parsed.data.fromAccountId === goal.linkedAccountId) return badRequest(res, 'Choose a different account to contribute from');

    const accountCount = await prisma.account.count({ where: { userId: req.user!.id, id: parsed.data.fromAccountId } });
    if (!accountCount) return badRequest(res, 'That account does not belong to you', 'ACCOUNT_NOT_FOUND');

    const rule = new RRule({ freq: RRule.MONTHLY, bymonthday: parsed.data.dayOfMonth, dtstart: startOfUtcDay(new Date()) });
    const nextRunAt = rule.after(new Date(), true) ?? startOfUtcDay(new Date());
    const template = {
        description: `Goal · ${goal.name}`,
        lines: [
            { accountId: goal.linkedAccountId, amountPaise: amount.toString() },
            { accountId: parsed.data.fromAccountId, amountPaise: (-amount).toString() },
        ],
    };

    const saved = goal.recurringRuleId
        ? await prisma.recurringRule.update({
            where: { id: goal.recurringRuleId },
            data: {
                name: `Goal · ${goal.name}`,
                template,
                rrule: `FREQ=MONTHLY;BYMONTHDAY=${parsed.data.dayOfMonth}`,
                nextRunAt,
                isActive: true,
                deletedAt: null,
            },
        })
        : await prisma.recurringRule.create({
            data: {
                userId: req.user!.id,
                name: `Goal · ${goal.name}`,
                template,
                rrule: `FREQ=MONTHLY;BYMONTHDAY=${parsed.data.dayOfMonth}`,
                startDate: startOfUtcDay(new Date()),
                nextRunAt,
                mode: 'AUTO_POST',
            },
        });

    const updated = await prisma.goal.update({ where: { id: goal.id }, data: { recurringRuleId: saved.id } });
    res.status(201).json({
        data: {
            goal: serialiseGoal(await goalProgress(updated)),
            rule: { id: saved.id, nextRunAt: saved.nextRunAt.toISOString(), rrule: saved.rrule },
        },
    });
});

export default router;
