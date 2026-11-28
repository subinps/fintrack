import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    api,
    chartOfAccounts,
    createAccount,
    createUser,
    prisma,
    postTransactionViaApi,
    startServer,
    stopServer,
    type TestUser,
} from './harness';

let user: TestUser;
let other: TestUser;

const now = new Date();
const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const iso = (date: Date) => date.toISOString().slice(0, 10);
const today = iso(now);
const thisMonth = iso(thisMonthStart);
const lastMonth = iso(lastMonthStart);

async function createBudget(body: Record<string, unknown>): Promise<{ status: number; body: any }> {
    return api('/api/budgets', { method: 'POST', token: user.token, body });
}

async function spend(accountId: number, amountPaise: string, date = today, description = 'Spend') {
    return postTransactionViaApi(user, {
        description,
        date,
        lines: [
            { accountId, amount: amountPaise },
            { accountId: user.accounts.bank, amount: `-${amountPaise}` },
        ],
    });
}

before(async () => {
    await startServer();
    user = await createUser('budgets');
    await chartOfAccounts(user);
    other = await createUser('budgets-other');
    await chartOfAccounts(other);
});

after(async () => {
    await stopServer();
});

describe('budgets', () => {
    it('counts only completed spending inside the current period', async () => {
        const budget = await createBudget({
            name: 'Monthly spending',
            period: 'MONTHLY',
            startDate: thisMonth,
            items: [{ name: 'Food', accountId: user.accounts.food, amountPaise: '100000' }],
        });
        assert.equal(budget.status, 201, JSON.stringify(budget.body));

        await spend(user.accounts.food, '25000');
        await spend(user.accounts.food, '15000');
        await postTransactionViaApi(user, {
            description: 'Groceries on order',
            date: today,
            status: 'DRAFT',
            lines: [
                { accountId: user.accounts.food, amount: '9000' },
                { accountId: user.accounts.bank, amount: '-9000' },
            ],
        });
        await spend(user.accounts.food, '7777', lastMonth, 'Last month lunch');

        const detail = await api(`/api/budgets/${budget.body.data.id}`, { token: user.token });
        assert.equal(detail.status, 200);
        const item = detail.body.data.items[0];
        assert.equal(item.spentPaise, '40000');
        assert.equal(item.remainingPaise, '60000');
        assert.equal(item.limitPaise, '100000');
        assert.equal(item.percentUsed, 40);
        assert.equal(detail.body.data.daysLeft >= 0, true);
    });

    it('notifies once per threshold per period and never repeats', async () => {
        const budget = await createBudget({
            name: 'Alert budget',
            period: 'MONTHLY',
            startDate: thisMonth,
            items: [{ name: 'Rent', accountId: user.accounts.rent, amountPaise: '10000', alertAt: [50, 80, 100] }],
        });
        assert.equal(budget.status, 201);
        await spend(user.accounts.rent, '8100', today, 'Half a rent');

        const first = await api(`/api/budgets/${budget.body.data.id}/check-alerts`, { method: 'POST', token: user.token });
        assert.equal(first.status, 200);
        assert.equal(first.body.data.sent, 2, 'crossed 50% and 80% in one go');

        const second = await api(`/api/budgets/${budget.body.data.id}/check-alerts`, { method: 'POST', token: user.token });
        assert.equal(second.body.data.sent, 0);

        const notifications = await prisma.notification.count({ where: { userId: user.id, type: 'BUDGET' } });
        assert.equal(notifications >= 2, true);

        await spend(user.accounts.rent, '2500', today, 'Over the rent budget');
        const third = await api(`/api/budgets/${budget.body.data.id}/check-alerts`, { method: 'POST', token: user.token });
        assert.equal(third.body.data.sent, 2, '100% and overspend are separate alerts');
    });

    it('carries unspent money forward when rollover is on', async () => {
        const groceries = await createAccount(user, 'Groceries', 'EXPENSE', 'Food');
        const budget = await createBudget({
            name: 'Rollover groceries',
            period: 'MONTHLY',
            startDate: lastMonth,
            rollover: true,
            rolloverCapPaise: '25000',
            items: [{ name: 'Groceries', accountId: groceries, amountPaise: '20000' }],
        });
        assert.equal(budget.status, 201, JSON.stringify(budget.body));
        const budgetId = budget.body.data.id;

        await spend(groceries, '5000', iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10))), 'Last month groceries');

        const detail = await api(`/api/budgets/${budgetId}`, { token: user.token });
        const item = detail.body.data.items[0];
        assert.equal(item.rolloverPaise, '15000', 'last month left 15000 unspent');
        assert.equal(item.limitPaise, '35000');
    });

    it('rolls child categories into their parent and blocks foreign accounts', async () => {
        const budget = await createBudget({
            name: 'Nested budget',
            period: 'MONTHLY',
            startDate: thisMonth,
            items: [
                { name: 'Essentials', amountPaise: '0' },
            ],
        });
        assert.equal(budget.status, 201);
        const parent = budget.body.data.items[0];

        const addChild = await api(`/api/budgets/${budget.body.data.id}/items`, {
            method: 'POST',
            token: user.token,
            body: { name: 'Food', accountId: user.accounts.food, amountPaise: '50000', parentId: parent.id },
        });
        assert.equal(addChild.status, 201);
        const nested = addChild.body.data.items.find((item: any) => item.id === parent.id);
        assert.equal(nested.children.length, 1);
        assert.equal(nested.limitPaise, '50000');

        const foreign = await api(`/api/budgets/${budget.body.data.id}/items`, {
            method: 'POST',
            token: user.token,
            body: { name: 'Not mine', accountId: other.accounts.food, amountPaise: '1000' },
        });
        assert.equal(foreign.status, 400);
        assert.equal(foreign.body.code, 'ACCOUNT_NOT_FOUND');
    });

    it('keeps budgets private to their owner', async () => {
        const budget = await createBudget({
            name: 'Private budget',
            period: 'MONTHLY',
            startDate: thisMonth,
            items: [{ name: 'Food', accountId: user.accounts.food, amountPaise: '1000' }],
        });
        const response = await api(`/api/budgets/${budget.body.data.id}`, { token: other.token });
        assert.equal(response.status, 404);

        const list = await api('/api/budgets', { token: other.token });
        assert.equal(list.status, 200);
        assert.equal(list.body.data.length, 0);
    });

    it('turns a 50/30/20 template into limits from period income', async () => {
        const income = await postTransactionViaApi(user, {
            description: 'November salary',
            date: today,
            lines: [
                { accountId: user.accounts.bank, amount: '300000' },
                { accountId: user.accounts.salary, amount: '-300000' },
            ],
        });
        assert.equal(income.status, 200, JSON.stringify(income.body));

        const created = await api('/api/budgets/from-template', {
            method: 'POST',
            token: user.token,
            body: { templateId: '50-30-20' },
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const status = created.body.data;
        assert.equal(status.type, 'PERCENT_INCOME');
        assert.equal(status.totalLimitPaise, '300000');
        const needs = status.items.find((item: any) => item.name === 'Needs');
        assert.equal(needs.limitPaise, '150000');
    });

    it('reports monthly summary with unbudgeted categories', async () => {
        const summary = await api('/api/budgets/summary', { token: user.token });
        assert.equal(summary.status, 200);
        assert.equal(BigInt(summary.body.data.incomePaise) >= 300000n, true);
        assert.equal(BigInt(summary.body.data.expensePaise) > 0n, true);
        assert.equal(Array.isArray(summary.body.data.topCategories), true);
        assert.equal(Array.isArray(summary.body.data.unbudgeted), true);
    });

    it('reserves budget money and upcoming bills in safe-to-spend', async () => {
        const safe = await api('/api/budgets/safe-to-spend', { token: user.token });
        assert.equal(safe.status, 200);
        const data = safe.body.data;
        assert.equal(
            BigInt(data.safeToSpendPaise),
            BigInt(data.liquidPaise) - BigInt(data.reservedBudgetPaise) - BigInt(data.upcomingBillsPaise) - BigInt(data.debtDuesPaise)
        );
    });

    it('rejects malformed custom budgets', async () => {
        const missingEnd = await createBudget({
            name: 'Broken custom',
            period: 'CUSTOM',
            startDate: thisMonth,
            items: [{ name: 'Food', accountId: user.accounts.food, amountPaise: '1000' }],
        });
        assert.equal(missingEnd.status, 400);
    });
});

describe('goals', () => {
    it('tracks progress from the linked account and moves real money', async () => {
        const savings = await createAccount(user, 'Japan trip', 'ASSET', 'Bank');
        const goal = await api('/api/goals', {
            method: 'POST',
            token: user.token,
            body: { name: 'Japan trip', targetAmountPaise: '200000', targetDate: iso(new Date(now.getTime() + 180 * 86_400_000)), linkedAccountId: savings },
        });
        assert.equal(goal.status, 201, JSON.stringify(goal.body));
        assert.equal(goal.body.data.progressPaise, '0');

        const contribution = await api(`/api/goals/${goal.body.data.id}/contribute`, {
            method: 'POST',
            token: user.token,
            body: { amountPaise: '50000', fromAccountId: user.accounts.bank },
        });
        assert.equal(contribution.status, 200, JSON.stringify(contribution.body));
        assert.equal(contribution.body.data.progressPaise, '50000');
        assert.equal(contribution.body.data.percentComplete, 25);
        assert.equal(contribution.body.data.remainingPaise, '150000');

        const bankAfter = await prisma.transactionSplit.aggregate({
            where: { accountId: savings, transaction: { userId: user.id, status: 'COMPLETED' } },
            _sum: { amount: true },
        });
        assert.equal(bankAfter._sum.amount, 50000n);
    });

    it('increments manual progress when no account is linked', async () => {
        const goal = await api('/api/goals', {
            method: 'POST',
            token: user.token,
            body: { name: 'New laptop', targetAmountPaise: '100000' },
        });
        assert.equal(goal.status, 201);
        const contributed = await api(`/api/goals/${goal.body.data.id}/contribute`, {
            method: 'POST',
            token: user.token,
            body: { amountPaise: '25000' },
        });
        assert.equal(contributed.body.data.progressPaise, '25000');
        assert.equal(contributed.body.data.status, 'ON_TRACK');
    });

    it('schedules an auto contribution as a monthly recurring transfer', async () => {
        const savings = await createAccount(user, 'Car fund', 'ASSET', 'Bank');
        const goal = await api('/api/goals', {
            method: 'POST',
            token: user.token,
            body: { name: 'Car fund', targetAmountPaise: '500000', linkedAccountId: savings },
        });
        const scheduled = await api(`/api/goals/${goal.body.data.id}/auto-contribute`, {
            method: 'POST',
            token: user.token,
            body: { amountPaise: '20000', dayOfMonth: 5, fromAccountId: user.accounts.bank },
        });
        assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
        assert.equal(scheduled.body.data.rule.rrule, 'FREQ=MONTHLY;BYMONTHDAY=5');

        const rule = await prisma.recurringRule.findUnique({ where: { id: scheduled.body.data.rule.id } });
        assert.ok(rule);
        const template = rule!.template as { lines: { accountId: number; amountPaise: string }[] };
        assert.equal(template.lines.reduce((sum, line) => sum + BigInt(line.amountPaise), 0n), 0n);
    });

    it("does not expose another user's goals", async () => {
        const goals = await api('/api/goals', { token: other.token });
        assert.equal(goals.status, 200);
        assert.equal(goals.body.data.length, 0);
    });
});
