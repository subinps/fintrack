import crypto from 'node:crypto';
import { getQuickJS, Scope } from 'quickjs-emscripten';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { onLedgerEvent, type LedgerEventType } from '../lib/events';
import { postTransaction, type TransactionStatusValue } from './ledger';
import { resolveAccountOrThrow } from './account-resolver';
import { budgetOverview } from './budgets';

export const MAX_POSTS_PER_RUN = 100;
export const MAX_LOGS_PER_RUN = 200;
export const SCRIPT_TIMEOUT_MS = 5000;
export const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;

export interface AutomationLine {
    account: string;
    amount: number | string;
}

export interface PendingPost {
    description: string;
    date?: string;
    status?: TransactionStatusValue;
    lines: { account: string; amountPaise: bigint }[];
}

export interface PlannedPost {
    description: string;
    date: string;
    lines: { account: string; amountPaise: number }[];
}

export interface RunResult {
    status: 'OK' | 'FAILED' | 'DRY_RUN' | 'SKIPPED';
    logs: string[];
    error: string | null;
    transactionIds: number[];
    durationMs: number;
    /** What a dry run would have posted. */
    planned: PlannedPost[];
}

const derivedKey = () => crypto.createHash('sha256').update(process.env.JWT_SECRET ?? 'fintrack-dev-secret').digest();

export function encryptSecrets(plain: Record<string, string>): { encryptedSecrets: string; secretsIv: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        encryptedSecrets: Buffer.concat([body, tag]).toString('base64'),
        secretsIv: iv.toString('base64'),
    };
}

export function decryptSecrets(encrypted: string | null, iv: string | null): Record<string, string> {
    if (!encrypted || !iv) return {};
    try {
        const raw = Buffer.from(encrypted, 'base64');
        const tag = raw.subarray(raw.length - 16);
        const body = raw.subarray(0, raw.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey(), Buffer.from(iv, 'base64'));
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
        return JSON.parse(plain);
    } catch (error) {
        logger.error({ err: error }, 'could not decrypt automation secrets');
        return {};
    }
}

async function accountSnapshot(userId: string) {
    const accounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true, type: true, subType: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    const grouped = await prisma.transactionSplit.groupBy({
        by: ['accountId'],
        where: { account: { userId }, transaction: { userId, status: 'COMPLETED', deletedAt: null } },
        _sum: { amount: true },
    });
    const balances = new Map(grouped.map((row) => [row.accountId, row._sum.amount ?? 0n]));
    return accounts.map((account) => {
        const raw = balances.get(account.id) ?? 0n;
        const natural = account.type === 'ASSET' || account.type === 'EXPENSE' ? raw : -raw;
        return { ...account, balancePaise: Number(natural) };
    });
}

async function transactionSnapshot(userId: string, days = 90) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await prisma.transaction.findMany({
        where: { userId, status: 'COMPLETED', deletedAt: null, date: { gte: since } },
        orderBy: { date: 'desc' },
        take: 500,
        select: {
            id: true,
            date: true,
            description: true,
            splits: { select: { amount: true, account: { select: { name: true } } } },
        },
    });
    return rows.map((row) => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        description: row.description,
        lines: row.splits.map((split) => ({ account: split.account.name, amountPaise: Number(split.amount) })),
    }));
}

const PRELUDE = `
const __rt = globalThis.__host;
const accounts = JSON.parse(__rt.accounts());
const vars = JSON.parse(__rt.vars());
const secrets = JSON.parse(__rt.secrets());
const budgets = JSON.parse(__rt.budgets());
const event = JSON.parse(__rt.event());
function today() {
  return __rt.today();
}
function balance(name) {
  const account = accounts.find((a) => a.name.toLowerCase() === String(name).toLowerCase());
  if (!account) throw new Error('No account named ' + name);
  return account.balancePaise;
}
function transactions(filter) {
  return JSON.parse(__rt.transactions(JSON.stringify(filter || {})));
}
function budget(name) {
  const status = budgets.find((b) => b.name.toLowerCase() === String(name).toLowerCase());
  if (!status) throw new Error('No budget named ' + name);
  return status;
}
function post(description, lines, options) {
  const payload = { description: String(description), lines: lines || [], options: options || {} };
  return JSON.parse(__rt.post(JSON.stringify(payload)));
}
function log() {
  __rt.log(Array.prototype.slice.call(arguments).map((value) =>
    typeof value === 'string' ? value : JSON.stringify(value)).join(' '));
}
`;

export interface RunOptions {
    automationId: string;
    userId: string;
    trigger?: string;
    dryRun?: boolean;
    now?: Date;
    /** Present for EVENT triggered runs, so a script can react to the entry that fired it. */
    event?: { type: string; transactionId?: number };
}

interface AutomationForRun {
    id: string;
    userId: string;
    name: string;
    script: string;
    variables: unknown;
    triggerConfig: unknown;
    encryptedSecrets: string | null;
    secretsIv: string | null;
    isActive: boolean;
    archivedAt: Date | null;
}

/**
 * Runs one automation in a QuickJS sandbox: no file system, no network, 16 MB of
 * memory and a 5 second wall clock. Every write goes through LedgerService, so a
 * script cannot produce an unbalanced entry even if it tries.
 */
export async function runAutomation(options: RunOptions): Promise<RunResult> {
    const started = Date.now();
    const now = options.now ?? new Date();
    const dryRun = options.dryRun ?? false;

    const automation = (await prisma.automation.findFirst({
        where: { id: options.automationId, userId: options.userId },
    })) as AutomationForRun | null;

    if (!automation || automation.archivedAt) {
        return { status: 'SKIPPED', logs: [], error: 'Automation not found', transactionIds: [], durationMs: 0, planned: [] };
    }

    const user = await prisma.user.findUnique({ where: { id: options.userId }, select: { automationPaused: true } });
    if (user?.automationPaused) {
        return { status: 'SKIPPED', logs: [], error: 'Automation is paused', transactionIds: [], durationMs: 0, planned: [] };
    }
    // A dry run writes nothing, so drafts may be rehearsed before they are switched on.
    if (!automation.isActive && !options.dryRun) {
        return { status: 'SKIPPED', logs: [], error: 'Automation is paused', transactionIds: [], durationMs: 0, planned: [] };
    }

    const [accounts, transactions, budgets] = await Promise.all([
        accountSnapshot(options.userId),
        transactionSnapshot(options.userId),
        budgetOverview(options.userId, now),
    ]);

    const logs: string[] = [];
    const pending: PendingPost[] = [];
    const runKey = `${automation.id}:${now.toISOString().slice(0, 13)}`;
    let failure: string | null = null;

    const runtime = (await getQuickJS()).newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(1024 * 1024);
    runtime.setInterruptHandler(() => Date.now() - started > SCRIPT_TIMEOUT_MS);

    const context = runtime.newContext();
    // Every handle created here must be freed before the runtime goes away, or QuickJS aborts on dispose.
    const scope = new Scope();
    try {
        const host = scope.manage(context.newObject());
        const global = scope.manage(context.global);
        const define = (name: string, fn: (arg: string) => string) => {
            const handle = scope.manage(
                context.newFunction(name, (argHandle) => {
                    const arg = argHandle ? context.getString(argHandle) : '';
                    if (argHandle) scope.manage(argHandle);
                    return context.newString(fn(arg));
                })
            );
            context.setProp(host, name, handle);
        };

        define('accounts', () => JSON.stringify(accounts));
        define('vars', () => JSON.stringify(automation.variables ?? {}));
        define('secrets', () => JSON.stringify(decryptSecrets(automation.encryptedSecrets, automation.secretsIv)));
        define('today', () => now.toISOString().slice(0, 10));
        define('event', () => JSON.stringify(options.event ?? { type: 'MANUAL' }));
        define('budgets', () =>
            JSON.stringify(
                budgets.map((budget) => ({
                    name: budget.name,
                    period: budget.period,
                    spentPaise: Number(budget.totalSpentPaise),
                    limitPaise: Number(budget.totalLimitPaise),
                    remainingPaise: Number(budget.totalRemainingPaise),
                    percentUsed: budget.percentUsed,
                    daysLeft: budget.daysLeft,
                    pace: budget.pace,
                }))
            )
        );
        define('transactions', (raw) => {
            const filter = raw ? (JSON.parse(raw) as { account?: string; since?: string; contains?: string }) : {};
            const rows = transactions.filter((row) => {
                if (filter.since && row.date < filter.since) return false;
                if (filter.contains && !row.description.toLowerCase().includes(filter.contains.toLowerCase())) return false;
                if (filter.account && !row.lines.some((line) => line.account === filter.account)) return false;
                return true;
            });
            return JSON.stringify(rows.slice(0, 100));
        });
        define('log', (message) => {
            if (logs.length < MAX_LOGS_PER_RUN) logs.push(String(message).slice(0, 500));
            return 'true';
        });
        let postError: string | null = null;
        define('post', (raw) => {
            if (postError) return JSON.stringify({ ok: false, error: postError });
            if (pending.length >= MAX_POSTS_PER_RUN) {
                postError = `A run may post at most ${MAX_POSTS_PER_RUN} transactions`;
                return JSON.stringify({ ok: false, error: postError });
            }
            const payload = JSON.parse(raw) as {
                description?: string;
                lines?: AutomationLine[];
                options?: { date?: string; status?: TransactionStatusValue };
            };
            if (!payload.description || !Array.isArray(payload.lines) || payload.lines.length < 2) {
                postError = 'post() needs a description and at least two lines';
                return JSON.stringify({ ok: false, error: postError });
            }
            const lines = payload.lines.map((line) => ({
                account: String(line.account),
                amountPaise: BigInt(Math.round(Number(line.amount))),
            }));
            const total = lines.reduce((sum, line) => sum + line.amountPaise, 0n);
            if (total !== 0n) {
                postError = 'post() lines must sum to zero (debits positive, credits negative)';
                return JSON.stringify({ ok: false, error: postError });
            }
            pending.push({
                description: payload.description.slice(0, 200),
                date: payload.options?.date,
                status: payload.options?.status,
                lines,
            });
            return JSON.stringify({ ok: true, queued: pending.length });
        });

        context.setProp(global, '__host', host);
        const result = context.evalCode(`${PRELUDE}\n;(function () {\n${automation.script}\n})();`, 'automation.js');
        if (result.error) {
            const dumped = context.dump(result.error) as { name?: string; message?: string } | string;
            failure =
                typeof dumped === 'string'
                    ? dumped
                    : dumped?.message
                      ? `${dumped.name ?? 'Error'}: ${dumped.message}`
                      : 'Script failed';
            result.error.dispose();
        } else {
            result.value.dispose();
        }
        if (!failure && postError) failure = postError;
    } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
    } finally {
        scope.dispose();
        context.dispose();
        runtime.dispose();
    }

    const transactionIds: number[] = [];
    if (!failure && !dryRun) {
        for (const [index, entry] of pending.entries()) {
            try {
                const lineInputs = [] as { accountId: number; amount: bigint }[];
                for (const line of entry.lines) {
                    const account = await resolveAccountOrThrow(options.userId, line.account);
                    lineInputs.push({ accountId: account.id, amount: line.amountPaise });
                }
                const created = await postTransaction({
                    userId: options.userId,
                    description: entry.description,
                    date: entry.date ?? now.toISOString().slice(0, 10),
                    lines: lineInputs,
                    status: entry.status ?? 'COMPLETED',
                    source: 'AUTOMATION',
                    sourceId: automation.id,
                    idempotencyKey: `automation:${runKey}:${index}`,
                    actor: 'AUTOMATION',
                });
                transactionIds.push(created.id);
            } catch (error) {
                failure = error instanceof Error ? error.message : String(error);
                break;
            }
        }
    }

    const durationMs = Date.now() - started;
    const status: RunResult['status'] = dryRun && !failure ? 'DRY_RUN' : failure ? 'FAILED' : 'OK';

    await prisma.automationRun
        .create({
            data: {
                automationId: automation.id,
                runDate: new Date(now.toISOString().slice(0, 10)),
                isDryRun: dryRun,
                trigger: options.trigger ?? 'MANUAL',
                status,
                logs: [...logs, ...(dryRun ? pending.map((entry) => `would post: ${entry.description}`) : [])],
                error: failure,
                transactionIds,
                durationMs,
            },
        })
        .catch(async (error: { code?: string }) => {
            if (error.code === 'P2002') return;
            throw error;
        });

    if (!dryRun) {
        await prisma.automation.update({
            where: { id: automation.id },
            data: {
                lastRunAt: now,
                failCount: failure ? { increment: 1 } : 0,
                ...(failure && (await failCountOf(automation.id)) >= 3 ? { isActive: false } : {}),
            },
        });
    }

    const planned = pending.map((entry) => ({
        description: entry.description,
        date: entry.date ?? now.toISOString().slice(0, 10),
        lines: entry.lines.map((line) => ({ account: line.account, amountPaise: Number(line.amountPaise) })),
    }));

    return {
        status,
        logs: dryRun ? [...logs, ...planned.map((entry) => `would post: ${entry.description}`)] : logs,
        error: failure,
        transactionIds,
        durationMs,
        planned,
    };
}

async function failCountOf(automationId: string) {
    const row = await prisma.automation.findUnique({ where: { id: automationId }, select: { failCount: true } });
    return (row?.failCount ?? 0) + 1;
}

export function shouldRunCron(expression: string, date: Date): boolean {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const match = (field: string, value: number, max: number) => {
        if (field === '*') return true;
        for (const chunk of field.split(',')) {
            const stepMatch = chunk.match(/^(?:\*|(\d+))\/(\d+)$/);
            if (stepMatch) {
                const start = stepMatch[1] ? Number(stepMatch[1]) : 0;
                if (value >= start && (value - start) % Number(stepMatch[2]) === 0) return true;
                continue;
            }
            const rangeMatch = chunk.match(/^(\d+)-(\d+)$/);
            if (rangeMatch) {
                if (value >= Number(rangeMatch[1]) && value <= Number(rangeMatch[2])) return true;
                continue;
            }
            if (Number(chunk) === value) return true;
        }
        return value >= 0 && value <= max ? false : false;
    };
    return (
        match(minute, date.getUTCMinutes(), 59) &&
        match(hour, date.getUTCHours(), 23) &&
        match(dayOfMonth, date.getUTCDate(), 31) &&
        match(month, date.getUTCMonth() + 1, 12) &&
        match(dayOfWeek, date.getUTCDay(), 6)
    );
}

export function isCronExpression(expression: string): boolean {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    return parts.every((part) => /^[\d*,\-/]+$/.test(part));
}

/** Every minute: run the schedule-triggered automations that are due now. */
export async function runAutomationSweep(now: Date = new Date()): Promise<{ ran: number; failed: number }> {
    const automations = await prisma.automation.findMany({
        where: { isActive: true, archivedAt: null, triggerType: 'SCHEDULE' },
        select: { id: true, userId: true, triggerConfig: true },
    });
    let ran = 0;
    let failed = 0;
    for (const automation of automations) {
        const config = (automation.triggerConfig ?? {}) as { cron?: string };
        if (!config.cron || !shouldRunCron(config.cron, now)) continue;
        try {
            const result = await runAutomation({ automationId: automation.id, userId: automation.userId, trigger: 'SCHEDULE', now });
            ran += 1;
            if (result.status === 'FAILED') failed += 1;
        } catch (error) {
            failed += 1;
            logger.error({ err: error, automationId: automation.id }, 'automation run failed');
        }
    }
    return { ran, failed };
}

/** Ledger-event triggered automations, called from the ledger event bus. */
export async function runEventAutomations(userId: string, event: { type: LedgerEventType; transactionId?: number }) {
    const automations = await prisma.automation.findMany({
        where: { userId, isActive: true, archivedAt: null, triggerType: 'EVENT' },
        select: { id: true, triggerConfig: true },
    });
    for (const automation of automations) {
        const config = (automation.triggerConfig ?? {}) as { events?: string[] };
        if (!config.events?.includes(event.type)) continue;
        await runAutomation({
            automationId: automation.id,
            userId,
            trigger: `EVENT:${event.type}`,
            event: { type: event.type, transactionId: event.transactionId },
        }).catch((error) => logger.error({ err: error, automationId: automation.id }, 'event automation failed'));
    }
}

/** Subscribe the automation engine to the ledger bus; call once when the API boots. */
export function registerAutomationEventHandlers(): void {
    onLedgerEvent((event) => {
        void runEventAutomations(event.userId, { type: event.type, transactionId: event.transactionId });
    });
}
