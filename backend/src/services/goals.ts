import { type Goal } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface GoalProgress {
    id: string;
    name: string;
    targetAmount: bigint;
    targetDate: Date | null;
    linkedAccountId: number | null;
    linkedAccountName: string | null;
    recurringRuleId: string | null;
    savedPaise: bigint;
    progressPaise: bigint;
    remainingPaise: bigint;
    percentComplete: number;
    monthsLeft: number | null;
    requiredMonthlyPaise: bigint | null;
    status: 'ON_TRACK' | 'BEHIND' | 'DONE';
    notes: string | null;
    createdAt: Date;
}

async function accountBalance(accountId: number): Promise<bigint> {
    const aggregate = await prisma.transactionSplit.aggregate({
        where: { accountId, transaction: { status: 'COMPLETED', deletedAt: null } },
        _sum: { amount: true },
    });
    return aggregate._sum.amount ?? 0n;
}

export async function goalProgress(goal: Goal, now: Date = new Date()): Promise<GoalProgress> {
    let progress = goal.savedPaise;
    let accountName: string | null = null;

    if (goal.linkedAccountId) {
        const account = await prisma.account.findFirst({
            where: { id: goal.linkedAccountId, userId: goal.userId },
            select: { name: true },
        });
        if (account) {
            accountName = account.name;
            progress = await accountBalance(goal.linkedAccountId);
        }
    }

    const target = goal.targetAmount;
    const remaining = target - progress;
    const percent = target > 0n ? Math.min(100, Number((progress * 10_000n) / target) / 100) : 0;
    const done = progress >= target && target > 0n;

    let monthsLeft: number | null = null;
    let requiredMonthly: bigint | null = null;
    let status: GoalProgress['status'] = done ? 'DONE' : 'ON_TRACK';

    if (goal.targetDate) {
        const msLeft = new Date(goal.targetDate).getTime() - now.getTime();
        monthsLeft = Math.max(0, Math.ceil(msLeft / (30 * 86_400_000)));
        if (monthsLeft === 0) {
            requiredMonthly = remaining > 0n ? remaining : 0n;
        } else {
            requiredMonthly = remaining > 0n ? (remaining + BigInt(monthsLeft) - 1n) / BigInt(monthsLeft) : 0n;
        }
        if (!done && monthsLeft === 0 && remaining > 0n) status = 'BEHIND';
        if (!done && monthsLeft > 0 && requiredMonthly != null && requiredMonthly > 0n) {
            // Without a contribution schedule we cannot judge pace; only flag when the deadline passed.
            status = 'ON_TRACK';
        }
    }

    return {
        id: goal.id,
        name: goal.name,
        targetAmount: target,
        targetDate: goal.targetDate,
        linkedAccountId: goal.linkedAccountId,
        linkedAccountName: accountName,
        recurringRuleId: goal.recurringRuleId,
        savedPaise: goal.savedPaise,
        progressPaise: progress,
        remainingPaise: remaining > 0n ? remaining : 0n,
        percentComplete: percent,
        monthsLeft,
        requiredMonthlyPaise: requiredMonthly,
        status,
        notes: goal.notes,
        createdAt: goal.createdAt,
    };
}

export async function goalList(userId: string, now: Date = new Date()): Promise<GoalProgress[]> {
    const goals = await prisma.goal.findMany({
        where: { userId, archivedAt: null },
        orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }],
    });
    const result: GoalProgress[] = [];
    for (const goal of goals) result.push(await goalProgress(goal, now));
    return result;
}
