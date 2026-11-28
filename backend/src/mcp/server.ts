import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { postTransaction, updateTransaction } from '../services/ledger';
import { resolveAccount } from '../services/account-resolver';
import { budgetOverview, safeToSpend, monthlySummary } from '../services/budgets';
import {
    balanceSheet,
    cashFlow,
    netWorthNow,
    profitLoss,
    rangeForMonth,
    spendingByCategory,
    trialBalance,
    type DateRange,
} from '../services/reports';
import { dayKey, startOfUtcDay } from '../services/recurring';
import { canWriteAccount, hasScope, type AuthenticatedToken } from '../services/tokens';

const SERVER_INSTRUCTIONS = `FinTrack is a double-entry personal ledger with accounts of type ASSET, LIABILITY, INCOME, EXPENSE and EQUITY.
Amounts are rupees in tool inputs and paise (integer strings) in responses. For assets and expenses a debit is positive; for liabilities and income a credit is positive.
Writes create DRAFT transactions unless the token may post directly; a human approves drafts in the FinTrack app. Prefer quick_add_expense for everyday spending.`;

const jsonSafe = (_key: string, value: unknown) => (typeof value === 'bigint' ? value.toString() : value);

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const json = (value: unknown): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value, jsonSafe, 2) }] });

const fail = (message: string, code = 'TOOL_ERROR'): ToolResult => json({ error: message, code });

const rupeesToPaise = (amount: number) => BigInt(Math.round(amount * 100));

function parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : startOfUtcDay(date);
}

function resolveRange(input: { month?: string; from?: string; to?: string }): DateRange {
    if (input.month) return rangeForMonth(input.month);
    const from = parseDate(input.from) ?? rangeForMonth(dayKey(new Date()).slice(0, 7)).from;
    const to = parseDate(input.to);
    if (to) return { from, to: new Date(to.getTime() + 86_400_000) };
    return rangeForMonth(dayKey(new Date()).slice(0, 7));
}

async function resolveOrThrow(userId: string, query: string, type?: string | string[]) {
    const result = await resolveAccount(userId, query, type ? { type } : {});
    if (result.kind === 'found') return result.account;
    if (result.kind === 'ambiguous') {
        throw new Error(
            `"${query}" matches several accounts: ${result.candidates.map((candidate) => candidate.name).join(', ')}. Use a more specific name.`
        );
    }
    throw new Error(
        `No account matches "${query}".${
            result.candidates.length ? ` Known accounts include ${result.candidates.slice(0, 6).map((candidate) => candidate.name).join(', ')}.` : ''
        }`
    );
}

async function defaultCashAccount(userId: string) {
    const account = await prisma.account.findFirst({
        where: { userId, type: 'ASSET', subType: { in: ['Bank', 'Cash', 'Wallet'] } },
        orderBy: { name: 'asc' },
    });
    if (!account) throw new Error('No bank or cash account exists yet. Create one in FinTrack first.');
    return account;
}

async function audit(
    token: AuthenticatedToken,
    tool: string,
    args: unknown,
    status: 'OK' | 'ERROR' | 'DENIED',
    startedAt: number,
    details: { summary?: string; error?: string; ip?: string } = {}
) {
    await prisma.mcpAuditLog
        .create({
            data: {
                tokenId: token.id,
                userId: token.userId,
                tool,
                args: JSON.parse(JSON.stringify(args ?? {}, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))),
                status,
                summary: details.summary ?? null,
                error: details.error ?? null,
                ip: details.ip ?? null,
                durationMs: Date.now() - startedAt,
            },
        })
        .catch(() => undefined);
}

type ToolHandler = (args: any) => Promise<unknown>;

export function buildMcpServer(token: AuthenticatedToken, ip?: string): McpServer {
    const server = new McpServer({ name: 'fintrack', version: '1.0.0' }, { instructions: SERVER_INSTRUCTIONS });
    const userId = token.userId;

    const read = (name: string, description: string, inputSchema: Record<string, z.ZodType>, handler: ToolHandler) => {
        server.registerTool(name, { description, inputSchema }, async (args) => {
            const started = Date.now();
            if (!hasScope(token, 'read')) {
                await audit(token, name, args, 'DENIED', started, { ip, error: 'Token lacks the read scope' });
                return { ...fail('This token cannot read data', 'SCOPE_DENIED'), isError: true };
            }
            try {
                const result = await handler(args);
                await audit(token, name, args, 'OK', started, { ip });
                return json(result);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Tool failed';
                await audit(token, name, args, 'ERROR', started, { ip, error: message });
                return { ...fail(message), isError: true };
            }
        });
    };

    const write = (name: string, description: string, inputSchema: Record<string, z.ZodType>, handler: ToolHandler) => {
        server.registerTool(name, { description, inputSchema }, async (args) => {
            const started = Date.now();
            if (!hasScope(token, 'write:transactions')) {
                await audit(token, name, args, 'DENIED', started, { ip, error: 'Token lacks write scope' });
                return { ...fail('This token is read-only. Create a token with the write scope in FinTrack.', 'SCOPE_DENIED'), isError: true };
            }
            try {
                const result = (await handler(args)) as { _summary?: string } | undefined;
                await audit(token, name, args, 'OK', started, { ip, summary: result?._summary });
                const payload = { ...(result ?? {}) } as Record<string, unknown>;
                delete payload._summary;
                return json(payload);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Tool failed';
                await audit(token, name, args, 'ERROR', started, { ip, error: message });
                return { ...fail(message), isError: true };
            }
        });
    };

    // ---------- Read tools ----------

    read('list_accounts', 'List every account with its current natural balance in paise.', {}, async () => {
        const accounts = await prisma.account.findMany({
            where: { userId },
            select: { id: true, name: true, type: true, subType: true, symbol: true, lastMarketPrice: true },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
        });
        const grouped = await prisma.transactionSplit.groupBy({
            by: ['accountId'],
            where: { account: { userId }, transaction: { userId, status: 'COMPLETED', deletedAt: null } },
            _sum: { amount: true },
        });
        const balances = new Map(grouped.map((row) => [row.accountId, row._sum.amount ?? 0n]));
        return {
            accounts: accounts.map((account) => {
                const raw = balances.get(account.id) ?? 0n;
                const natural = account.type === 'ASSET' || account.type === 'EXPENSE' ? raw : -raw;
                return { ...account, balancePaise: natural.toString() };
            }),
        };
    });

    read('get_account_balance', 'Balance of one account by name, e.g. "HDFC Savings".', { account: z.string().min(1) }, async ({ account }) => {
        const resolved = await resolveOrThrow(userId, account);
        const aggregate = await prisma.transactionSplit.aggregate({
            where: { accountId: resolved.id, transaction: { userId, status: 'COMPLETED', deletedAt: null } },
            _sum: { amount: true },
        });
        const raw = aggregate._sum.amount ?? 0n;
        const natural = resolved.type === 'ASSET' || resolved.type === 'EXPENSE' ? raw : -raw;
        return {
            account: resolved.name,
            type: resolved.type,
            subType: resolved.subType,
            balancePaise: natural.toString(),
            balanceFormatted: `₹${(Number(natural) / 100).toLocaleString('en-IN')}`,
        };
    });

    read('get_net_worth', 'Net worth (assets minus liabilities) now or on a past date.', { as_of: z.string().optional() }, async ({ as_of }) => {
        const asOf = parseDate(as_of) ?? new Date();
        const value = await netWorthNow(userId, asOf);
        return { asOf: dayKey(asOf), netWorthPaise: value.toString(), netWorthFormatted: `₹${(Number(value) / 100).toLocaleString('en-IN')}` };
    });

    read(
        'search_transactions',
        'Find transactions by text, category, date range or amount. Newest first.',
        {
            query: z.string().max(120).optional(),
            category: z.string().max(80).optional(),
            from: z.string().optional(),
            to: z.string().optional(),
            min_amount: z.number().min(0).optional(),
            max_amount: z.number().min(0).optional(),
            limit: z.number().int().min(1).max(100).optional(),
            offset: z.number().int().min(0).optional(),
        },
        async (input: any) => {
            const range = resolveRange(input);
            const transactions = await prisma.transaction.findMany({
                where: {
                    userId,
                    deletedAt: null,
                    date: { gte: range.from, lt: range.to },
                    ...(input.query ? { description: { contains: input.query, mode: 'insensitive' } } : {}),
                    ...(input.category
                        ? { splits: { some: { account: { userId, name: { contains: input.category, mode: 'insensitive' } } } } }
                        : {}),
                },
                include: { splits: { include: { account: { select: { id: true, name: true, type: true } } } } },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                take: input.limit ?? 20,
                skip: input.offset ?? 0,
            });

            const rows = transactions
                .map((transaction) => {
                    const outflow = transaction.splits.reduce(
                        (sum, split) => sum + (split.account.type === 'EXPENSE' && split.amount > 0n ? split.amount : 0n),
                        0n
                    );
                    const inflow = transaction.splits.reduce(
                        (sum, split) => sum + (split.account.type === 'INCOME' && split.amount < 0n ? -split.amount : 0n),
                        0n
                    );
                    return {
                        id: transaction.id,
                        date: dayKey(transaction.date),
                        description: transaction.description,
                        des: transaction.description,
                        status: transaction.status,
                        amountPaise: (outflow !== 0n ? outflow : inflow).toString(),
                        lines: transaction.splits.map((split) => ({
                            accountId: split.account.id,
                            account: split.account.name,
                            type: split.account.type,
                            amountPaise: split.amount.toString(),
                        })),
                    };
                })
                .filter((row) => {
                    const value = Number(row.amountPaise);
                    if (input.min_amount != null && value < input.min_amount * 100) return false;
                    if (input.max_amount != null && value > input.max_amount * 100) return false;
                    return true;
                });

            return { from: dayKey(range.from), to: dayKey(new Date(range.to.getTime() - 86_400_000)), count: rows.length, transactions: rows };
        }
    );

    read('get_transaction', 'One transaction with all of its splits.', { id: z.number().int().positive() }, async ({ id }) => {
        const transaction = await prisma.transaction.findFirst({
            where: { id, userId },
            include: { splits: { include: { account: { select: { id: true, name: true, type: true } } } } },
        });
        if (!transaction) throw new Error(`Transaction ${id} was not found`);
        return {
            id: transaction.id,
            date: dayKey(transaction.date),
            description: transaction.description,
            status: transaction.status,
            source: transaction.source,
            tags: transaction.tags,
            lines: transaction.splits.map((split) => ({
                account: split.account.name,
                type: split.account.type,
                amountPaise: split.amount.toString(),
            })),
        };
    });

    read(
        'spending_by_category',
        'Expense totals by category for a month (YYYY-MM) or explicit range.',
        { month: z.string().regex(/^\d{4}-\d{2}$/).optional(), from: z.string().optional(), to: z.string().optional() },
        async (input: any) => {
            const range = resolveRange(input);
            const rows = await spendingByCategory(userId, range);
            return {
                from: dayKey(range.from),
                to: dayKey(new Date(range.to.getTime() - 86_400_000)),
                totalPaise: rows.reduce((sum, row) => sum + row.amountPaise, 0n).toString(),
                categories: rows.map((row) => ({ accountId: row.accountId, name: row.name, spentPaise: row.amountPaise.toString() })),
            };
        }
    );

    read(
        'cash_flow',
        'Money in and out of bank and cash accounts, with a monthly breakdown.',
        { month: z.string().regex(/^\d{4}-\d{2}$/).optional(), from: z.string().optional(), to: z.string().optional() },
        async (input: any) => {
            const range = resolveRange(input);
            const flow = await cashFlow(userId, range);
            return {
                from: dayKey(flow.from),
                to: dayKey(flow.to),
                inflowPaise: flow.inflowPaise.toString(),
                outflowPaise: flow.outflowPaise.toString(),
                netPaise: flow.netPaise.toString(),
                byMonth: flow.byMonth.map((row) => ({
                    month: row.month,
                    inflowPaise: row.inflowPaise.toString(),
                    outflowPaise: row.outflowPaise.toString(),
                })),
            };
        }
    );

    read(
        'profit_loss',
        'Income and expenses for a month, with the net result.',
        { month: z.string().regex(/^\d{4}-\d{2}$/).optional(), from: z.string().optional(), to: z.string().optional() },
        async (input: any) => {
            const range = resolveRange(input);
            const report = await profitLoss(userId, range);
            return {
                from: dayKey(report.from),
                to: dayKey(report.to),
                totalIncomePaise: report.totalIncomePaise.toString(),
                totalExpensePaise: report.totalExpensePaise.toString(),
                netPaise: report.netPaise.toString(),
                income: report.income.map((row) => ({ name: row.name, amountPaise: row.amountPaise.toString() })),
                expenses: report.expenses.map((row) => ({ name: row.name, amountPaise: row.amountPaise.toString() })),
            };
        }
    );

    read('balance_sheet', 'Assets, liabilities and equity on a date, including net worth.', { as_of: z.string().optional() }, async ({ as_of }) => {
        const sheet = await balanceSheet(userId, parseDate(as_of) ?? new Date());
        return {
            asOf: dayKey(sheet.asOf),
            assets: sheet.assets.map((row) => ({ name: row.name, amountPaise: row.amountPaise.toString() })),
            liabilities: sheet.liabilities.map((row) => ({ name: row.name, amountPaise: row.amountPaise.toString() })),
            equity: sheet.equity.map((row) => ({ name: row.name, amountPaise: row.amountPaise.toString() })),
            totalAssetsPaise: sheet.totalAssetsPaise.toString(),
            totalLiabilitiesPaise: sheet.totalLiabilitiesPaise.toString(),
            netWorthPaise: sheet.netWorthPaise.toString(),
        };
    });

    read('trial_balance', 'Every account with a non-zero balance; debits and credits balance.', { as_of: z.string().optional() }, async ({ as_of }) => {
        const report = await trialBalance(userId, parseDate(as_of) ?? new Date());
        return {
            rows: report.rows.map((row) => ({
                name: row.name,
                type: row.type,
                balancePaise: row.amountPaise.toString(),
                side: row.amountPaise >= 0n ? 'DEBIT' : 'CREDIT',
            })),
            totalDebitPaise: report.totalDebitPaise.toString(),
            totalCreditPaise: report.totalCreditPaise.toString(),
            balanced: report.totalDebitPaise === report.totalCreditPaise,
        };
    });

    read('budget_status', 'Every active budget with limit, spend, remaining and pace.', {}, async () => {
        const budgets = await budgetOverview(userId);
        return {
            budgets: budgets.map((budget) => ({
                id: budget.id,
                name: budget.name,
                period: budget.period,
                periodStart: dayKey(budget.periodStart),
                periodEnd: dayKey(new Date(budget.periodEnd.getTime() - 86_400_000)),
                limitPaise: budget.totalLimitPaise.toString(),
                spentPaise: budget.totalSpentPaise.toString(),
                remainingPaise: budget.totalRemainingPaise.toString(),
                percentUsed: Math.round(budget.percentUsed),
                pace: budget.pace,
                daysLeft: budget.daysLeft,
                categories: budget.items.map((item) => ({
                    name: item.name,
                    limitPaise: item.limitPaise.toString(),
                    spentPaise: item.spentPaise.toString(),
                    remainingPaise: item.remainingPaise.toString(),
                })),
            })),
        };
    });

    read(
        'safe_to_spend',
        'Cash genuinely free after budgets, scheduled bills and debt due.',
        { days: z.number().int().min(1).max(180).optional() },
        async ({ days }) => {
            const result = await safeToSpend(userId, days ?? 30);
            return {
                horizonDays: result.horizonDays,
                safeToSpendPaise: result.safeToSpendPaise.toString(),
                liquidPaise: result.liquidPaise.toString(),
                reservedBudgetPaise: result.reservedBudgetPaise.toString(),
                upcomingBillsPaise: result.upcomingBillsPaise.toString(),
                debtDuesPaise: result.debtDuesPaise.toString(),
            };
        }
    );

    read('monthly_summary', 'Income, expense, savings rate and top categories for this month.', {}, async () => {
        const summary = await monthlySummary(userId);
        return {
            month: summary.month,
            incomePaise: summary.incomePaise.toString(),
            expensePaise: summary.expensePaise.toString(),
            savingsPaise: summary.savingsPaise.toString(),
            savingsRate: summary.savingsRate,
            topCategories: summary.topCategories.map((row) => ({ name: row.name, spentPaise: row.spentPaise.toString() })),
            unbudgeted: summary.unbudgeted.map((row) => ({ name: row.name, spentPaise: row.spentPaise.toString() })),
        };
    });

    read('list_recurring', 'Recurring rules with schedule, mode and next run.', {}, async () => {
        const rules = await prisma.recurringRule.findMany({ where: { userId, deletedAt: null }, orderBy: { nextRunAt: 'asc' } });
        return {
            rules: rules.map((rule) => ({
                id: rule.id,
                name: rule.name,
                rrule: rule.rrule,
                mode: rule.mode,
                isActive: rule.isActive,
                nextRunAt: rule.nextRunAt.toISOString().slice(0, 10),
                template: rule.template,
            })),
        };
    });

    read('list_drafts', 'Draft transactions waiting for approval in the app.', { limit: z.number().int().min(1).max(100).optional() }, async ({ limit }) => {
        const drafts = await prisma.transaction.findMany({
            where: { userId, status: 'DRAFT', deletedAt: null },
            include: { splits: { include: { account: { select: { name: true, type: true } } } } },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
            take: limit ?? 20,
        });
        return {
            drafts: drafts.map((draft) => ({
                id: draft.id,
                date: dayKey(draft.date),
                description: draft.description,
                source: draft.source,
                lines: draft.splits.map((split) => ({
                    account: split.account.name,
                    type: split.account.type,
                    amountPaise: split.amount.toString(),
                })),
            })),
        };
    });

    // ---------- Write tools ----------

    write(
        'quick_add_expense',
        'Record a spend, e.g. "₹450 on groceries from HDFC Savings". Creates a draft unless the token posts directly.',
        {
            amount: z.number().positive().describe('Amount in rupees, e.g. 450.50'),
            category: z.string().min(1).describe('Expense category name, e.g. Groceries'),
            paid_from: z.string().optional().describe('Asset account the money left; defaults to the first bank account'),
            description: z.string().max(200).optional(),
            date: z.string().optional().describe('YYYY-MM-DD, defaults to today'),
            dry_run: z.boolean().optional(),
        },
        async (input: any) => {
            const category = await resolveOrThrow(userId, input.category, 'EXPENSE');
            const paid = input.paid_from ? await resolveOrThrow(userId, input.paid_from, 'ASSET') : await defaultCashAccount(userId);
            if (!canWriteAccount(token, paid.id)) throw new Error(`This token may not spend from ${paid.name}`);

            const amount = rupeesToPaise(input.amount);
            const draftMode = token.writeMode !== 'DIRECT' || input.dry_run === true;
            const date = parseDate(input.date) ?? startOfUtcDay(new Date());
            const description = input.description?.trim() || `${category.name} spend`;

            const preview = {
                date: dayKey(date),
                description,
                lines: [
                    { account: category.name, type: category.type, amountPaise: amount.toString() },
                    { account: paid.name, type: paid.type, amountPaise: (-amount).toString() },
                ],
                status: draftMode ? 'DRAFT' : 'COMPLETED',
            };

            if (input.dry_run) return { dryRun: true, wouldCreate: preview, _summary: 'dry run' };

            const transaction = await postTransaction({
                userId,
                description,
                date,
                source: 'MCP',
                status: draftMode ? 'DRAFT' : 'COMPLETED',
                lines: [
                    { accountId: category.id, amount },
                    { accountId: paid.id, amount: -amount },
                ],
            });

            return {
                ...preview,
                id: transaction.id,
                status: transaction.status,
                message: draftMode ? 'Draft created. Approve it in FinTrack › Transactions › Drafts.' : 'Recorded.',
                _summary: `expense ${amount.toString()} paise`,
            };
        }
    );

    write(
        'create_transaction',
        'Post any balanced transaction. Lines are rupees, positive for debit and negative for credit; they must sum to zero.',
        {
            description: z.string().min(1).max(200),
            date: z.string().optional(),
            lines: z.array(z.object({ account: z.string().min(1), amount: z.number() })).min(2).max(20),
            dry_run: z.boolean().optional(),
        },
        async (input: any) => {
            const resolved: { accountId: number; name: string; type: string; amount: bigint }[] = [];
            for (const line of input.lines) {
                const account = await resolveOrThrow(userId, line.account);
                if (line.amount < 0 && !canWriteAccount(token, account.id)) {
                    throw new Error(`This token may not take money from ${account.name}`);
                }
                resolved.push({ accountId: account.id, name: account.name, type: account.type, amount: rupeesToPaise(line.amount) });
            }
            const total = resolved.reduce((sum, line) => sum + line.amount, 0n);
            if (total !== 0n) throw new Error(`Lines must sum to zero; they sum to ${total} paise`);

            const draftMode = token.writeMode !== 'DIRECT' || input.dry_run === true;
            const date = parseDate(input.date) ?? startOfUtcDay(new Date());

            if (input.dry_run) {
                return {
                    dryRun: true,
                    wouldCreate: {
                        date: dayKey(date),
                        description: input.description,
                        lines: resolved.map((line) => ({ account: line.name, type: line.type, amountPaise: line.amount.toString() })),
                        status: draftMode ? 'DRAFT' : 'COMPLETED',
                    },
                    _summary: 'dry run',
                };
            }

            const transaction = await postTransaction({
                userId,
                description: input.description,
                date,
                source: 'MCP',
                status: draftMode ? 'DRAFT' : 'COMPLETED',
                lines: resolved.map((line) => ({ accountId: line.accountId, amount: line.amount })),
            });

            return {
                id: transaction.id,
                status: transaction.status,
                date: dayKey(date),
                description: input.description,
                lines: resolved.map((line) => ({ account: line.name, type: line.type, amountPaise: line.amount.toString() })),
                _summary: `transaction ${transaction.id}`,
            };
        }
    );

    write(
        'update_transaction',
        'Change a draft description, date or lines; or complete or void a transaction.',
        {
            id: z.number().int().positive(),
            description: z.string().min(1).max(200).optional(),
            date: z.string().optional(),
            lines: z.array(z.object({ account: z.string().min(1), amount: z.number() })).min(2).max(20).optional(),
            status: z.enum(['DRAFT', 'COMPLETED', 'VOIDED']).optional(),
        },
        async (input: any) => {
            const existing = await prisma.transaction.findFirst({ where: { id: input.id, userId, deletedAt: null } });
            if (!existing) throw new Error(`Transaction ${input.id} was not found`);
            if (existing.status === 'COMPLETED' && input.status === 'DRAFT') {
                throw new Error('A completed transaction cannot go back to draft');
            }

            let lines: { accountId: number; amount: bigint }[] | undefined;
            if (input.lines) {
                lines = [];
                for (const line of input.lines) {
                    const account = await resolveOrThrow(userId, line.account);
                    lines.push({ accountId: account.id, amount: rupeesToPaise(line.amount) });
                }
                if (lines.reduce((sum, line) => sum + line.amount, 0n) !== 0n) throw new Error('Lines must sum to zero');
            }

            const updated = await updateTransaction({
                userId,
                id: input.id,
                description: input.description,
                date: input.date ? parseDate(input.date) ?? undefined : undefined,
                lines,
                status: input.status,
                actor: 'mcp',
            });
            return { id: updated.id, status: updated.status, description: updated.description, _summary: `updated ${updated.id}` };
        }
    );

    write('delete_transaction', 'Void a transaction instead of deleting it; the ledger keeps an audit trail.', { id: z.number().int().positive() }, async ({ id }) => {
        const existing = await prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } });
        if (!existing) throw new Error(`Transaction ${id} was not found`);
        const updated = await updateTransaction({ userId, id, status: 'VOIDED', actor: 'mcp' });
        return { id: updated.id, status: updated.status, message: 'Voided. History is preserved.', _summary: `voided ${id}` };
    });

    write(
        'create_recurring',
        'Schedule a repeating posting, e.g. rent monthly. Lines are rupees summing to zero.',
        {
            name: z.string().min(1).max(80),
            rrule: z.string().min(1).describe('RFC 5545 rule, e.g. FREQ=MONTHLY;BYMONTHDAY=5'),
            description: z.string().min(1).max(200),
            lines: z.array(z.object({ account: z.string().min(1), amount: z.number() })).min(2).max(20),
            mode: z.enum(['AUTO_POST', 'CONFIRM', 'ASK']).optional(),
            start_date: z.string().optional(),
        },
        async (input: any) => {
            const { RRule } = await import('rrule');
            let rule: InstanceType<typeof RRule>;
            try {
                rule = new RRule({ ...RRule.parseString(input.rrule), dtstart: startOfUtcDay(new Date()) });
            } catch {
                throw new Error(`Could not understand the schedule "${input.rrule}". Use an RFC 5545 rule such as FREQ=MONTHLY;BYMONTHDAY=5`);
            }
            if (!rule.after(new Date(), true)) throw new Error('That schedule never runs');

            const resolved: { accountId: number; amountPaise: string }[] = [];
            for (const line of input.lines) {
                const account = await resolveOrThrow(userId, line.account);
                resolved.push({ accountId: account.id, amountPaise: rupeesToPaise(line.amount).toString() });
            }
            if (resolved.reduce((sum, line) => sum + BigInt(line.amountPaise), 0n) !== 0n) throw new Error('Lines must sum to zero');

            const nextRunAt = rule.after(new Date(), true) ?? startOfUtcDay(new Date());
            const created = await prisma.recurringRule.create({
                data: {
                    userId,
                    name: input.name,
                    template: { description: input.description, lines: resolved },
                    rrule: input.rrule,
                    startDate: parseDate(input.start_date) ?? startOfUtcDay(new Date()),
                    nextRunAt,
                    mode: input.mode ?? 'AUTO_POST',
                },
            });
            return {
                id: created.id,
                name: created.name,
                rrule: created.rrule,
                mode: created.mode,
                nextRunAt: dayKey(nextRunAt),
                _summary: `recurring ${created.id}`,
            };
        }
    );

    return server;
}
