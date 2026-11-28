import { Prisma, RecurringRule } from '@prisma/client';
import { RRule } from 'rrule';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { formatPaise, rupeesToPaise } from '../lib/money';
import { createNotification } from './notifications';
import { emitLedgerEvent } from '../lib/events';
import { postTransaction, updateTransaction, LedgerError, type LedgerLine } from './ledger';

/**
 * Recurring dates are calendar days. They are stored as UTC midnight of the local
 * calendar date (the app records dates, not instants), so `2026-11-28` is always
 * `2026-11-28T00:00:00.000Z` regardless of the user's timezone.
 */
export const DAY_MS = 86_400_000;

export const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

export const startOfUtcDay = (date: Date): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

export const parseDay = (value: string | Date): Date => {
    if (value instanceof Date) return startOfUtcDay(value);
    const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (isoDay) return new Date(Date.UTC(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3])));
    return startOfUtcDay(new Date(value));
};

/** Today's calendar date in the user's timezone, as UTC midnight. */
export function todayInZone(timeZone: string, now: Date = new Date()): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const [year, month, day] = formatter.format(now).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

export const isWeekend = (date: Date): boolean => {
    const day = date.getUTCDay();
    return day === 0 || day === 6;
};

export type WeekendPolicy = 'SAME' | 'PREV_BUSINESS' | 'NEXT_BUSINESS';

/** India has no exchange holidays in this app's scope: a business day is Monday-Friday. */
export function applyWeekendPolicy(date: Date, policy: WeekendPolicy): Date {
    if (policy === 'SAME' || !isWeekend(date)) return date;
    if (policy === 'PREV_BUSINESS') {
        let cursor = date;
        while (isWeekend(cursor)) cursor = addDays(cursor, -1);
        return cursor;
    }
    let cursor = date;
    while (isWeekend(cursor)) cursor = addDays(cursor, 1);
    return cursor;
}

export type TemplateLine = { accountId: number; amountPaise: string; units?: string | null };
export type RecurringTemplate = { description: string; lines: TemplateLine[] };

export function parseTemplate(template: Prisma.JsonValue): RecurringTemplate {
    const value = template as { description?: unknown; lines?: unknown };
    const description = typeof value?.description === 'string' ? value.description : 'Recurring entry';
    const rawLines = Array.isArray(value?.lines) ? value.lines : [];
    const lines = rawLines.map((line) => {
        const entry = line as { accountId?: unknown; amountPaise?: unknown; units?: unknown };
        const accountId = Number(entry.accountId);
        if (!Number.isInteger(accountId)) throw new LedgerError(400, 'INVALID_TEMPLATE', 'Every template line needs an accountId');
        const amountPaise = String(entry.amountPaise ?? '0');
        if (!/^-?\d+$/.test(amountPaise)) throw new LedgerError(400, 'INVALID_TEMPLATE', 'Template amounts must be integer paise strings');
        return {
            accountId,
            amountPaise,
            units: entry.units === undefined || entry.units === null ? null : String(entry.units),
        };
    });
    const total = lines.reduce((sum, line) => sum + BigInt(line.amountPaise), 0n);
    if (lines.length === 0 || total !== 0n) {
        throw new LedgerError(400, 'UNBALANCED_TEMPLATE', 'Recurring template splits must sum to zero');
    }
    return { description, lines };
}

export function templateTotalPaise(template: RecurringTemplate): bigint {
    return template.lines
        .filter((line) => BigInt(line.amountPaise) > 0n)
        .reduce((sum, line) => sum + BigInt(line.amountPaise), 0n);
}

export type Formula =
    | { kind: 'PERCENT_OF_BALANCE'; accountId: number; percent: number; minPaise?: string; maxPaise?: string };

export function parseFormula(value: string | null): Formula | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value) as Formula;
        if (parsed.kind === 'PERCENT_OF_BALANCE' && Number.isFinite(parsed.percent)) return parsed;
    } catch {
        // fall through: a malformed formula degrades to the fixed template instead of failing posts
    }
    return null;
}

/** rrule instances are built from the stored rule string anchored at startDate (floating UTC days). */
export function dueDatesForRule(rule: Pick<RecurringRule, 'rrule' | 'startDate' | 'endDate'>, from: Date, until: Date, limit = 400): Date[] {
    const stored = rule.rrule.trim().replace(/^RRULE:/i, '');
    let options: Partial<import('rrule').Options>;
    try {
        options = RRule.parseString(stored);
    } catch {
        return [];
    }
    options.dtstart = startOfUtcDay(rule.startDate);
    const rrule = new RRule(options);
    const dates = rrule.between(addDays(from, 0), until, true).map(startOfUtcDay);
    const lowerBound = from.getTime();
    return dates
        .filter((date) => date.getTime() >= lowerBound)
        .filter((date) => !rule.endDate || date.getTime() <= startOfUtcDay(rule.endDate).getTime())
        .slice(0, limit);
}

export function nextDueAfter(rule: Pick<RecurringRule, 'rrule' | 'startDate' | 'endDate'>, after: Date): Date | null {
    const horizon = addDays(after, 366 * 4);
    const dates = dueDatesForRule(rule, addDays(after, 1), horizon, 1);
    return dates[0] ?? null;
}

/** Natural (display) balance: assets/expenses are debit-positive, everything else credit-positive. */
export async function naturalBalancePaise(
    client: Prisma.TransactionClient | typeof prisma,
    userId: string,
    accountId: number,
    asOfExclusive?: Date
): Promise<bigint> {
    const account = await client.account.findFirst({ where: { id: accountId, userId }, select: { type: true } });
    if (!account) throw new LedgerError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    const aggregate = await client.transactionSplit.aggregate({
        where: {
            accountId,
            transaction: {
                userId,
                status: 'COMPLETED',
                ...(asOfExclusive ? { date: { lt: asOfExclusive } } : {}),
            },
        },
        _sum: { amount: true },
    });
    const raw = aggregate._sum.amount ?? 0n;
    const debitPositive = account.type === 'ASSET' || account.type === 'EXPENSE';
    return debitPositive ? raw : -raw;
}

/**
 * Splits `target` across `lines` proportionally to their absolute amounts, keeping every
 * sign, so the result still sums to zero and no paise are lost (largest remainder).
 */
export function scaleLinesToTotal(lines: LedgerLine[], targetPaise: bigint): LedgerLine[] {
    const debits = lines.filter((line) => line.amount > 0n);
    const credits = lines.filter((line) => line.amount < 0n);
    if (debits.length === 0 || credits.length === 0) return lines;

    const allocate = (group: LedgerLine[], total: bigint, sign: 1n | -1n) => {
        const weights = group.map((line) => Number(line.amount < 0n ? -line.amount : line.amount));
        const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
        const raw = weights.map((weight) => (Number(total) * weight) / weightSum);
        const floored = raw.map((value) => BigInt(Math.trunc(value)));
        let remainder = total - floored.reduce((sum, value) => sum + value, 0n);
        const order = raw
            .map((value, index) => ({ index, fraction: value - Math.trunc(value) }))
            .sort((a, b) => b.fraction - a.fraction);
        const result = [...floored];
        let cursor = 0;
        while (remainder > 0n && order.length > 0) {
            result[order[cursor % order.length].index] += 1n;
            remainder -= 1n;
            cursor += 1;
        }
        return group.map((line, index) => ({ ...line, amount: result[index] * sign }));
    };

    return [...allocate(debits, targetPaise, 1n), ...allocate(credits, targetPaise, -1n)];
}

export async function resolveTemplate(
    rule: RecurringRule,
    userId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
    today: Date = todayInZone(rule.timezone)
): Promise<{ template: RecurringTemplate; lines: LedgerLine[]; requiresAmount: boolean; totalPaise: bigint }> {
    const template = parseTemplate(rule.template);
    let lines: LedgerLine[] = template.lines.map((line) => ({
        accountId: line.accountId,
        amount: BigInt(line.amountPaise),
        units: line.units ?? undefined,
    }));
    let requiresAmount = rule.amountMode === 'ASK';

    if (rule.amountMode === 'FORMULA') {
        const formula = parseFormula(rule.formula);
        if (formula) {
            const balance = await naturalBalancePaise(client, userId, formula.accountId, today);
            let target = (balance * BigInt(Math.round(formula.percent * 100))) / 10_000n;
            if (target < 0n) target = -target;
            if (formula.minPaise) target = target < BigInt(formula.minPaise) ? BigInt(formula.minPaise) : target;
            if (formula.maxPaise) target = target > BigInt(formula.maxPaise) ? BigInt(formula.maxPaise) : target;
            if (target > 0n) lines = scaleLinesToTotal(lines, target);
        } else {
            requiresAmount = true;
        }
    }

    const totalPaise = lines
        .filter((line) => line.amount > 0n)
        .reduce((sum, line) => sum + line.amount, 0n);

    return { template, lines, requiresAmount, totalPaise };
}

export function renderDescription(description: string, date: Date): string {
    const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return description.replace(/\{\{\s*date\s*\}\}/gi, label).replace(/\{\{\s*month\s*\}\}/gi, label.slice(3));
}

export type ProcessResult = {
    ruleId: string;
    posted: number;
    pending: number;
    skipped: number;
    failed: number;
    nextRunAt: Date | null;
    locked?: boolean;
};

/**
 * Processes one rule inside its own transaction, holding a row lock so two workers (or a
 * manual "run now" and the cron) never post the same occurrence twice. Idempotency keys
 * `rule:{id}:{dueDate}` make a retry safe even if the lock is lost.
 */
export async function processRecurringRule(
    ruleId: string,
    options: { now?: Date } = {}
): Promise<ProcessResult> {
    const now = options.now ?? new Date();
    const outcome: ProcessResult = { ruleId, posted: 0, pending: 0, skipped: 0, failed: 0, nextRunAt: null };
    const notifications: { userId: string; ruleName: string; date: Date; transactionId: number; draft: boolean }[] = [];
    const postedTransactions: { userId: string; transactionId: number; status: string }[] = [];

    await prisma.$transaction(async (client) => {
        const locked = await client.$queryRaw<{ id: string }[]>`
            SELECT id FROM "RecurringRule" WHERE id = ${ruleId} FOR UPDATE SKIP LOCKED
        `;
        if (locked.length === 0) {
            outcome.locked = true;
            return;
        }

        const rule = await client.recurringRule.findUnique({ where: { id: ruleId } });
        if (!rule || rule.deletedAt || !rule.isActive) return;

        const today = todayInZone(rule.timezone, now);
        const dueDates = dueDatesForRule(rule, rule.nextRunAt, today);
        if (dueDates.length === 0) {
            const next = nextDueAfter(rule, today);
            outcome.nextRunAt = next;
            await client.recurringRule.update({
                where: { id: rule.id },
                data: { nextRunAt: next ?? addDays(today, 365), isActive: next ? rule.isActive : false },
            });
            return;
        }

        const remainingRuns = rule.maxRuns === null ? Number.POSITIVE_INFINITY : Math.max(rule.maxRuns - rule.runCount, 0);
        const work = dueDates.slice(0, Number.isFinite(remainingRuns) ? remainingRuns : dueDates.length);

        const skip: Date[] = [];
        if (rule.catchUp === 'SKIP') {
            skip.push(...work);
        } else if (rule.catchUp === 'LATEST' && work.length > 1) {
            skip.push(...work.slice(0, -1));
        }

        for (const rawDate of skip) {
            const dueDate = applyWeekendPolicy(rawDate, rule.weekendPolicy as WeekendPolicy);
            await client.recurringOccurrence.upsert({
                where: { ruleId_dueDate: { ruleId: rule.id, dueDate } },
                create: { ruleId: rule.id, dueDate, status: 'SKIPPED', note: `Missed run skipped (catch-up: ${rule.catchUp})` },
                update: { status: 'SKIPPED', note: `Missed run skipped (catch-up: ${rule.catchUp})` },
            });
            outcome.skipped += 1;
        }

        const toPost = work.filter((date) => !skip.includes(date));
        for (const rawDate of toPost) {
            const adjusted = applyWeekendPolicy(rawDate, rule.weekendPolicy as WeekendPolicy);
            const dueDate = adjusted.getTime() > today.getTime() ? today : adjusted;
            const existing = await client.recurringOccurrence.findUnique({
                where: { ruleId_dueDate: { ruleId: rule.id, dueDate } },
            });
            if (existing) continue;

            try {
                const { template, lines, requiresAmount, totalPaise } = await resolveTemplate(rule, rule.userId, client, today);
                const draft = rule.mode === 'CONFIRM' || requiresAmount;
                const status = draft ? 'DRAFT' : 'COMPLETED';
                const transaction = await postTransaction({
                    userId: rule.userId,
                    description: renderDescription(template.description, dueDate),
                    date: dueDate,
                    lines,
                    status,
                    source: 'RECURRING',
                    sourceId: rule.id,
                    idempotencyKey: `rule:${rule.id}:${dayKey(dueDate)}`,
                    actor: 'RECURRING',
                    client,
                });
                await client.recurringOccurrence.create({
                    data: {
                        ruleId: rule.id,
                        dueDate,
                        status: draft ? 'PENDING' : 'POSTED',
                        transactionId: transaction.id,
                        amountPaise: totalPaise,
                        postedAt: new Date(),
                        note: requiresAmount ? 'Amount to be confirmed' : null,
                    },
                });
                postedTransactions.push({ userId: rule.userId, transactionId: transaction.id, status });
                if (draft) {
                    outcome.pending += 1;
                    notifications.push({ userId: rule.userId, ruleName: rule.name, date: dueDate, transactionId: transaction.id, draft: true });
                } else {
                    outcome.posted += 1;
                }
            } catch (error) {
                outcome.failed += 1;
                logger.error({ err: error, ruleId: rule.id, dueDate }, 'recurring occurrence failed');
                await client.recurringOccurrence.upsert({
                    where: { ruleId_dueDate: { ruleId: rule.id, dueDate } },
                    create: { ruleId: rule.id, dueDate, status: 'FAILED', error: String((error as Error).message ?? error) },
                    update: { status: 'FAILED', error: String((error as Error).message ?? error) },
                });
            }
        }

        const lastProcessed = work[work.length - 1];
        const next = nextDueAfter(rule, lastProcessed);
        const exhausted = rule.maxRuns !== null && rule.runCount + toPost.length >= rule.maxRuns;
        const active = Boolean(next) && !exhausted && (!rule.endDate || next!.getTime() <= startOfUtcDay(rule.endDate).getTime());
        await client.recurringRule.update({
            where: { id: rule.id },
            data: {
                nextRunAt: next ?? lastProcessed,
                isActive: active,
                runCount: { increment: toPost.length - outcome.failed },
                lastRunAt: new Date(),
            },
        });
        outcome.nextRunAt = next;
    });

    for (const posted of postedTransactions) {
        emitLedgerEvent({ type: 'transaction.created', userId: posted.userId, transactionId: posted.transactionId });
        if (posted.status === 'COMPLETED') {
            emitLedgerEvent({ type: 'transaction.completed', userId: posted.userId, transactionId: posted.transactionId });
        }
    }

    for (const notification of notifications) {
        await createNotification({
            userId: notification.userId,
            type: 'RECURRING_CONFIRM',
            title: `${notification.ruleName} is ready to approve`,
            body: `A draft for ${dayKey(notification.date)} was created by your recurring rule. Review the amount and approve it.`,
            href: `/?tab=transactions&draft=${notification.transactionId}`,
        }).catch((error) => logger.error({ err: error }, 'recurring notification failed'));
    }

    return outcome;
}

/** Cron body: picks every rule that is due, oldest first, and processes it. */
export async function runRecurringSweep(now: Date = new Date()): Promise<{ processed: number; posted: number; failed: number }> {
    const due = await prisma.recurringRule.findMany({
        where: { isActive: true, deletedAt: null, nextRunAt: { lte: now } },
        select: { id: true },
        orderBy: { nextRunAt: 'asc' },
        take: 500,
    });

    let posted = 0;
    let failed = 0;
    for (const rule of due) {
        try {
            const result = await processRecurringRule(rule.id, { now });
            posted += result.posted + result.pending;
            failed += result.failed;
        } catch (error) {
            failed += 1;
            logger.error({ err: error, ruleId: rule.id }, 'recurring rule processing failed');
        }
    }
    return { processed: due.length, posted, failed };
}

/** Reminder sweep: one notification per rule per day, N days before the next occurrence. */
export async function sendRecurringReminders(now: Date = new Date()): Promise<number> {
    const rules = await prisma.recurringRule.findMany({
        where: { isActive: true, deletedAt: null, remindDaysBefore: { gt: 0 } },
    });
    let sent = 0;
    for (const rule of rules) {
        const today = todayInZone(rule.timezone, now);
        const dueDate = applyWeekendPolicy(rule.nextRunAt, rule.weekendPolicy as WeekendPolicy);
        const daysAway = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
        if (daysAway > rule.remindDaysBefore || daysAway < 0) continue;

        const already = await prisma.notification.findFirst({
            where: {
                userId: rule.userId,
                type: 'RECURRING_REMINDER',
                href: `/?tab=recurring&rule=${rule.id}`,
                createdAt: { gte: addDays(now, -1) },
            },
            select: { id: true },
        });
        if (already) continue;

        await createNotification({
            userId: rule.userId,
            type: 'RECURRING_REMINDER',
            title: `Upcoming: ${rule.name}`,
            body: `Due ${dayKey(dueDate)} (${daysAway === 0 ? 'today' : `in ${daysAway} day${daysAway === 1 ? '' : 's'}`}).`,
            href: `/?tab=recurring&rule=${rule.id}`,
        });
        sent += 1;
    }
    return sent;
}

export type ForecastPoint = { date: string; balance: number; inflow: number; outflow: number };

/**
 * Cash-flow forecast from liquid (bank/cash) balances plus upcoming recurring occurrences.
 * Investment accounts (those with a symbol) are excluded - they are not spendable cash.
 */
export async function cashFlowForecast(userId: string, days: number, now: Date = new Date()): Promise<ForecastPoint[]> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const timeZone = user?.timezone ?? 'Asia/Kolkata';
    const today = todayInZone(timeZone, now);

    const liquidAccounts = await prisma.account.findMany({
        where: { userId, type: 'ASSET', symbol: null },
        select: { id: true },
    });
    const liquidIds = new Set(liquidAccounts.map((account) => account.id));

    const balance = liquidIds.size
        ? await prisma.transactionSplit.aggregate({
              where: {
                  accountId: { in: [...liquidIds] },
                  transaction: { userId, status: 'COMPLETED', date: { lte: addDays(today, 1) } },
              },
              _sum: { amount: true },
          })
        : { _sum: { amount: 0n } };

    const rules = await prisma.recurringRule.findMany({
        where: { userId, isActive: true, deletedAt: null },
    });

    const byDay = new Map<string, { inflow: bigint; outflow: bigint }>();
    const horizon = addDays(today, days);
    for (const rule of rules) {
        const dates = dueDatesForRule(rule, today, horizon);
        const template = (() => {
            try {
                return parseTemplate(rule.template);
            } catch {
                return null;
            }
        })();
        if (!template) continue;
        for (const raw of dates) {
            const dueDate = applyWeekendPolicy(raw, rule.weekendPolicy as WeekendPolicy);
            const delta = template.lines
                .filter((line) => liquidIds.has(line.accountId))
                .reduce((sum, line) => sum + BigInt(line.amountPaise), 0n);
            if (delta === 0n) continue;
            const key = dayKey(dueDate);
            const entry = byDay.get(key) ?? { inflow: 0n, outflow: 0n };
            if (delta > 0n) entry.inflow += delta;
            else entry.outflow += -delta;
            byDay.set(key, entry);
        }
    }

    const series: ForecastPoint[] = [];
    let running = balance._sum.amount ?? 0n;
    for (let offset = 0; offset <= days; offset += 1) {
        const date = addDays(today, offset);
        const entry = byDay.get(dayKey(date));
        if (entry) running += entry.inflow - entry.outflow;
        series.push({
            date: dayKey(date),
            balance: Number(running) / 100,
            inflow: Number(entry?.inflow ?? 0n) / 100,
            outflow: Number(entry?.outflow ?? 0n) / 100,
        });
    }
    return series;
}

export type Suggestion = {
    id: string;
    description: string;
    lines: TemplateLine[];
    rrule: string;
    startDate: string;
    nextRunAt: string;
    occurrences: number;
    averageIntervalDays: number;
    confidence: number;
    sampleDates: string[];
};

const normaliseDescription = (description: string): string =>
    description
        .toLowerCase()
        .replace(/\d+/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const intervalToRule = (days: number): string | null => {
    if (days >= 6 && days <= 8) return 'FREQ=WEEKLY;INTERVAL=1';
    if (days >= 13 && days <= 16) return 'FREQ=WEEKLY;INTERVAL=2';
    if (days >= 27 && days <= 32) return 'FREQ=MONTHLY;INTERVAL=1';
    if (days >= 85 && days <= 95) return 'FREQ=MONTHLY;INTERVAL=3';
    if (days >= 360 && days <= 375) return 'FREQ=YEARLY;INTERVAL=1';
    return null;
};

/** Scans completed history for repeating patterns and proposes rules the user can create in one click. */
export async function suggestRecurring(userId: string, now: Date = new Date()): Promise<Suggestion[]> {
    const since = addDays(now, -180);
    const transactions = await prisma.transaction.findMany({
        where: { userId, status: 'COMPLETED', date: { gte: since } },
        include: { splits: true },
        orderBy: { date: 'asc' },
        take: 3000,
    });

    const groups = new Map<string, { description: string; lines: TemplateLine[]; dates: Date[]; amounts: bigint[] }>();
    for (const transaction of transactions) {
        if (transaction.splits.length < 2) continue;
        const accounts = transaction.splits.map((split) => split.accountId).sort((a, b) => a - b);
        const neutered = transaction.splits
            .slice()
            .sort((a, b) => a.accountId - b.accountId)
            .map((split) => ({ accountId: split.accountId, amountPaise: split.amount.toString(), units: split.units ? split.units.toString() : null }));
        const total = transaction.splits.filter((split) => split.amount > 0n).reduce((sum, split) => sum + split.amount, 0n);
        const bucket = Math.round(Number(total) / 100 / 10) * 10; // nearest ₹10 to tolerate small variation
        const key = `${accounts.join(',')}|${normaliseDescription(transaction.description)}|${bucket}`;
        const entry = groups.get(key) ?? {
            description: transaction.description,
            lines: neutered,
            dates: [],
            amounts: [],
        };
        entry.dates.push(startOfUtcDay(transaction.date));
        entry.amounts.push(total);
        groups.set(key, entry);
    }

    const existing = await prisma.recurringRule.findMany({ where: { userId, deletedAt: null }, select: { name: true, template: true } });
    const existingNames = new Set(existing.map((rule) => normaliseDescription(rule.name)));

    const suggestions: Suggestion[] = [];
    for (const [key, group] of groups) {
        if (group.dates.length < 3) continue;
        if (existingNames.has(normaliseDescription(group.description))) continue;

        const uniqueDays = [...new Set(group.dates.map(dayKey))].map((day) => new Date(`${day}T00:00:00.000Z`));
        const intervals: number[] = [];
        for (let index = 1; index < uniqueDays.length; index += 1) {
            intervals.push(Math.round((uniqueDays[index].getTime() - uniqueDays[index - 1].getTime()) / DAY_MS));
        }
        const average = intervals.reduce((sum, value) => sum + value, 0) / (intervals.length || 1);
        const rrule = intervalToRule(average);
        if (!rrule) continue;

        const consistent = intervals.filter((interval) => Math.abs(interval - average) <= Math.max(2, average * 0.15)).length;
        const regularity = consistent / (intervals.length || 1);
        if (regularity < 0.7) continue;

        const last = uniqueDays[uniqueDays.length - 1];
        const drift = Math.abs(Number(group.amounts[group.amounts.length - 1] - group.amounts[0])) / Number(group.amounts[0] || 1n);
        const confidence = Math.min(0.99, 0.55 + regularity * 0.3 + Math.min(group.dates.length, 6) * 0.02 - Math.min(drift, 0.4) * 0.4);

        suggestions.push({
            id: Buffer.from(key).toString('base64url').slice(0, 24),
            description: group.description,
            lines: group.lines,
            rrule,
            startDate: dayKey(uniqueDays[0]),
            nextRunAt: dayKey(applyWeekendPolicy(nextMonthlyLike(last, rrule), 'SAME')),
            occurrences: group.dates.length,
            averageIntervalDays: Math.round(average),
            confidence: Number(confidence.toFixed(2)),
            sampleDates: uniqueDays.slice(-5).map(dayKey),
        });
    }

    return suggestions
        .filter((suggestion) => suggestion.confidence >= 0.6)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 8);
}

function nextMonthlyLike(last: Date, rrule: string): Date {
    if (rrule.includes('YEARLY')) return addDays(last, 365);
    if (rrule.includes('INTERVAL=2')) return addDays(last, 14);
    if (rrule.includes('INTERVAL=3')) return addDays(last, 91);
    if (rrule.includes('WEEKLY')) return addDays(last, 7);
    return addDays(last, 30);
}

/** Builds the draft rule object for "Make recurring" on an existing transaction. */
export function templateFromTransaction(transaction: {
    description: string;
    splits: { accountId: number; amount: bigint; units: unknown }[];
}): RecurringTemplate {
    return {
        description: transaction.description,
        lines: transaction.splits.map((split) => ({
            accountId: split.accountId,
            amountPaise: split.amount.toString(),
            units: split.units === null || split.units === undefined ? null : String(split.units),
        })),
    };
}

/** Edits one occurrence: posted ones update their transaction in place; pending ones are re-priced. */
export async function updateOccurrence(
    userId: string,
    occurrenceId: string,
    input: { lines?: LedgerLine[]; date?: Date; skip?: boolean }
): Promise<{ occurrenceId: string; transactionId?: number | null }> {
    const occurrence = await prisma.recurringOccurrence.findFirst({
        where: { id: occurrenceId, rule: { userId } },
        include: { rule: true },
    });
    if (!occurrence) throw new LedgerError(404, 'OCCURRENCE_NOT_FOUND', 'Occurrence not found');

    if (input.skip && occurrence.status !== 'SKIPPED') {
        await prisma.recurringOccurrence.update({
            where: { id: occurrence.id },
            data: { status: 'SKIPPED', note: 'Skipped by user' },
        });
        return { occurrenceId: occurrence.id, transactionId: occurrence.transactionId };
    }

    if (occurrence.transactionId) {
        const updated = await updateTransaction({
            userId,
            id: occurrence.transactionId,
            lines: input.lines,
            date: input.date,
            actor: 'RECURRING',
        });
        const total = updated.splits.filter((split) => split.amount > 0n).reduce((sum, split) => sum + split.amount, 0n);
        await prisma.recurringOccurrence.update({ where: { id: occurrence.id }, data: { amountPaise: total } });
        return { occurrenceId: occurrence.id, transactionId: updated.id };
    }

    if (input.lines) {
        const total = input.lines.filter((line) => line.amount > 0n).reduce((sum, line) => sum + line.amount, 0n);
        await prisma.recurringOccurrence.update({
            where: { id: occurrence.id },
            data: {
                amountPaise: total,
                dueDate: input.date ?? occurrence.dueDate,
            },
        });
    }
    return { occurrenceId: occurrence.id, transactionId: null };
}

export { rupeesToPaise, formatPaise };
