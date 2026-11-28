import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    accountBalance,
    api,
    chartOfAccounts,
    createUser,
    prisma,
    postTransactionViaApi,
    startServer,
    stopServer,
    type TestUser,
} from './harness';
import { applyWeekendPolicy, scaleLinesToTotal, todayInZone, dayKey } from '../src/services/recurring';

let user: TestUser;
const today = dayKey(todayInZone('Asia/Kolkata'));
const daysAgo = (days: number) => dayKey(new Date(Date.now() - days * 86_400_000));

before(async () => {
    await startServer();
    user = await createUser('recurring');
    await chartOfAccounts(user);
});

after(async () => {
    await stopServer();
});

describe('ledger invariants', () => {
    it('rejects a transaction whose splits do not sum to zero', async () => {
        const result = await postTransactionViaApi(user, {
            description: 'Broken entry',
            date: today,
            lines: [
                { accountId: user.accounts.food, amount: '50000' },
                { accountId: user.accounts.bank, amount: '-40000' },
            ],
        });
        assert.equal(result.status, 400);
        assert.match(String(result.body.error), /sum to zero|balance/i);
    });

    it('accepts a balanced transaction and derives the balance from splits', async () => {
        const before = await accountBalance(user, user.accounts.bank);
        const created = await postTransactionViaApi(user, {
            description: 'Lunch',
            date: today,
            lines: [
                { accountId: user.accounts.food, amount: '45000' },
                { accountId: user.accounts.bank, amount: '-45000' },
            ],
        });
        assert.equal(created.status, 200, JSON.stringify(created.body));
        const after = await accountBalance(user, user.accounts.bank);
        assert.equal(after - before, -45000n);
    });

    it('keeps DRAFT and VOIDED transactions out of balances', async () => {
        const draft = await postTransactionViaApi(user, {
            description: 'Draft groceries',
            date: today,
            status: 'DRAFT',
            lines: [
                { accountId: user.accounts.food, amount: '10000' },
                { accountId: user.accounts.bank, amount: '-10000' },
            ],
        });
        assert.equal(draft.status, 200, JSON.stringify(draft.body));

        const beforeVoid = await accountBalance(user, user.accounts.bank);
        const posted = await postTransactionViaApi(user, {
            description: 'To be voided',
            date: today,
            lines: [
                { accountId: user.accounts.food, amount: '20000' },
                { accountId: user.accounts.bank, amount: '-20000' },
            ],
        });
        const afterPost = await accountBalance(user, user.accounts.bank);
        assert.equal(afterPost - beforeVoid, -20000n);

        const voided = await api(`/api/transactions/${posted.body.id}`, { method: 'DELETE', token: user.token });
        assert.ok(voided.status === 200 || voided.status === 204, `delete returned ${voided.status}`);
        const afterVoid = await accountBalance(user, user.accounts.bank);
        assert.equal(afterVoid, beforeVoid);
    });
});

describe('recurring rules', () => {
    it('supports the full rule lifecycle and posts through the ledger exactly once', async () => {
        const created = await api<{ data: { id: string } }>('/api/recurring', {
            method: 'POST',
            token: user.token,
            body: {
                name: 'Morning coffee',
                template: {
                    description: 'Morning coffee',
                    lines: [
                        { accountId: user.accounts.food, amountPaise: '12000' },
                        { accountId: user.accounts.bank, amountPaise: '-12000' },
                    ],
                },
                rrule: 'FREQ=DAILY;INTERVAL=1',
                startDate: today,
                mode: 'AUTO_POST',
                catchUp: 'ALL',
                amountMode: 'FIXED',
            },
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const ruleId = created.body.data.id;

        const before = await accountBalance(user, user.accounts.bank);
        const firstRun = await api(`/api/recurring/${ruleId}/run-now`, { method: 'POST', token: user.token });
        assert.equal(firstRun.status, 200, JSON.stringify(firstRun.body));
        assert.equal(firstRun.body.data.posted, 1);

        const secondRun = await api(`/api/recurring/${ruleId}/run-now`, { method: 'POST', token: user.token });
        assert.equal(secondRun.status, 200);
        assert.equal(secondRun.body.data.posted, 0, 'a rule must not post twice for the same due date');

        const after = await accountBalance(user, user.accounts.bank);
        assert.equal(after - before, -12000n);

        const occurrences = await api<{ data: unknown[] }>(`/api/recurring/${ruleId}/occurrences`, { token: user.token });
        assert.equal(occurrences.body.data.length, 1);
        assert.equal((occurrences.body.data[0] as { status: string }).status, 'POSTED');

        const paused = await api(`/api/recurring/${ruleId}/pause`, { method: 'POST', token: user.token });
        assert.equal(paused.status, 200);
        const resumed = await api(`/api/recurring/${ruleId}/resume`, { method: 'POST', token: user.token });
        assert.equal(resumed.status, 200);
        assert.equal(resumed.body.isActive, true);
    });

    it('catches up every missed occurrence with catchUp=ALL', async () => {
        const created = await api<{ data: { id: string } }>('/api/recurring', {
            method: 'POST',
            token: user.token,
            body: {
                name: 'Weekly top-up',
                template: {
                    description: 'Weekly top-up',
                    lines: [
                        { accountId: user.accounts.cash, amountPaise: '10000' },
                        { accountId: user.accounts.bank, amountPaise: '-10000' },
                    ],
                },
                rrule: 'FREQ=DAILY;INTERVAL=1',
                startDate: daysAgo(4),
                catchUp: 'ALL',
            },
        });
        const ruleId = created.body.data.id;
        await prisma.recurringRule.update({
            where: { id: ruleId },
            data: { nextRunAt: new Date(`${daysAgo(4)}T00:00:00.000Z`) },
        });

        const run = await api<{ data: { posted: number } }>(`/api/recurring/${ruleId}/run-now`, {
            method: 'POST',
            token: user.token,
        });
        assert.ok(run.body.data.posted >= 4, `expected at least 4 catch-up posts, got ${run.body.data.posted}`);

        const occurrences = await api<{ data: { dueDate: string }[] }>(`/api/recurring/${ruleId}/occurrences`, {
            token: user.token,
        });
        const unique = new Set(occurrences.body.data.map((occurrence) => occurrence.dueDate));
        assert.equal(unique.size, occurrences.body.data.length, 'occurrences are unique per due date');
    });

    it('skips missed occurrences with catchUp=SKIP', async () => {
        const created = await api<{ data: { id: string } }>('/api/recurring', {
            method: 'POST',
            token: user.token,
            body: {
                name: 'Skipper',
                template: {
                    description: 'Skipper',
                    lines: [
                        { accountId: user.accounts.cash, amountPaise: '5000' },
                        { accountId: user.accounts.bank, amountPaise: '-5000' },
                    ],
                },
                rrule: 'FREQ=DAILY;INTERVAL=1',
                startDate: daysAgo(3),
                catchUp: 'SKIP',
            },
        });
        const ruleId = created.body.data.id;
        await prisma.recurringRule.update({
            where: { id: ruleId },
            data: { nextRunAt: new Date(`${daysAgo(3)}T00:00:00.000Z`) },
        });
        const before = await accountBalance(user, user.accounts.bank);
        const run = await api<{ data: { posted: number; skipped: number } }>(`/api/recurring/${ruleId}/run-now`, {
            method: 'POST',
            token: user.token,
        });
        assert.equal(run.body.data.posted, 0);
        assert.ok(run.body.data.skipped >= 3);
        assert.equal(await accountBalance(user, user.accounts.bank), before);
    });

    it('creates DRAFT transactions plus a notification in CONFIRM mode', async () => {
        const created = await api<{ data: { id: string } }>('/api/recurring', {
            method: 'POST',
            token: user.token,
            body: {
                name: 'Rent confirm',
                template: {
                    description: 'Rent',
                    lines: [
                        { accountId: user.accounts.rent, amountPaise: '1500000' },
                        { accountId: user.accounts.bank, amountPaise: '-1500000' },
                    ],
                },
                rrule: 'FREQ=DAILY;INTERVAL=1',
                startDate: today,
                mode: 'CONFIRM',
            },
        });
        const ruleId = created.body.data.id;
        await prisma.recurringRule.update({ where: { id: ruleId }, data: { nextRunAt: new Date(`${today}T00:00:00.000Z`) } });

        const before = await accountBalance(user, user.accounts.bank);
        const run = await api<{ data: { pending: number } }>(`/api/recurring/${ruleId}/run-now`, {
            method: 'POST',
            token: user.token,
        });
        assert.equal(run.body.data.pending, 1);
        assert.equal(await accountBalance(user, user.accounts.bank), before, 'a draft must not move balances');

        const notifications = await api<{ items: { type: string }[] }>('/api/notifications', { token: user.token });
        assert.ok(notifications.body.items.some((item) => item.type === 'RECURRING_CONFIRM'));

        const occurrences = await api<{ data: { status: string; transactionId: number }[] }>(
            `/api/recurring/${ruleId}/occurrences`,
            { token: user.token }
        );
        assert.equal(occurrences.body.data[0].status, 'PENDING');

        const approve = await api(`/api/transactions/${occurrences.body.data[0].transactionId}/approve`, {
            method: 'PUT',
            token: user.token,
        });
        assert.equal(approve.status, 200, JSON.stringify(approve.body));
        assert.equal(await accountBalance(user, user.accounts.bank), before - 1500000n);
    });

    it("does not let one user read another user's rule", async () => {
        const other = await createUser('intruder');
        await chartOfAccounts(other);
        const created = await api<{ data: { id: string } }>('/api/recurring', {
            method: 'POST',
            token: user.token,
            body: {
                name: 'Private rule',
                template: {
                    description: 'Private rule',
                    lines: [
                        { accountId: user.accounts.cash, amountPaise: '1000' },
                        { accountId: user.accounts.bank, amountPaise: '-1000' },
                    ],
                },
                rrule: 'FREQ=WEEKLY',
                startDate: today,
            },
        });
        const response = await api(`/api/recurring/${created.body.data.id}`, { token: other.token });
        assert.equal(response.status, 404);
    });

    it('rejects a rule whose template is unbalanced', async () => {
        const response = await api('/api/recurring', {
            method: 'POST',
            token: user.token,
            body: {
                name: 'Bad rule',
                template: {
                    description: 'Bad',
                    lines: [
                        { accountId: user.accounts.food, amountPaise: '500' },
                        { accountId: user.accounts.bank, amountPaise: '-400' },
                    ],
                },
                rrule: 'FREQ=DAILY',
                startDate: today,
            },
        });
        assert.equal(response.status, 400);
    });
});

describe('phase 1 pure logic', () => {
    it('allocates scaled amounts without losing paise', () => {
        const lines = [
            { accountId: 1, amount: 3333n },
            { accountId: 2, amount: 3333n },
            { accountId: 3, amount: -6666n },
        ];
        const scaled = scaleLinesToTotal(lines, 10000n);
        const total = scaled.reduce((sum, line) => sum + line.amount, 0n);
        assert.equal(total, 0n);
        const debits = scaled.filter((line) => line.amount > 0n).reduce((sum, line) => sum + line.amount, 0n);
        assert.equal(debits, 10000n);
    });

    it('moves weekend dates according to the policy', () => {
        const saturday = new Date('2026-11-28T00:00:00.000Z');
        assert.equal(dayKey(applyWeekendPolicy(saturday, 'SAME')), '2026-11-28');
        assert.equal(dayKey(applyWeekendPolicy(saturday, 'PREV_BUSINESS')), '2026-11-27');
        assert.equal(dayKey(applyWeekendPolicy(saturday, 'NEXT_BUSINESS')), '2026-11-30');
    });
});

describe('recurring extras', () => {
    it('forecasts cash flow for the requested number of days', async () => {
        const response = await api<{ data: { date: string; balance: number }[] }>('/api/recurring/forecast?days=30', {
            token: user.token,
        });
        assert.equal(response.status, 200);
        assert.equal(response.body.data.length, 31);
        assert.equal(typeof response.body.data[0].balance, 'number');
    });

    it('suggests a recurring rule from repeated history', async () => {
        const fresh = await createUser('suggester');
        await chartOfAccounts(fresh);
        for (const offset of [90, 60, 30]) {
            const date = dayKey(new Date(Date.now() - offset * 86_400_000));
            const posted = await postTransactionViaApi(fresh, {
                description: 'Netflix Subscription',
                date,
                lines: [
                    { accountId: fresh.accounts.food, amount: '45000' },
                    { accountId: fresh.accounts.bank, amount: '-45000' },
                ],
            });
            assert.equal(posted.status, 200, JSON.stringify(posted.body));
        }
        const suggestions = await api<{ data: { rrule: string; description: string }[] }>('/api/recurring/suggestions', {
            token: fresh.token,
        });
        assert.equal(suggestions.status, 200);
        assert.ok(
            suggestions.body.data.some((suggestion) => suggestion.description === 'Netflix Subscription'),
            JSON.stringify(suggestions.body)
        );
    });

    it('builds a rule from an existing transaction', async () => {
        const posted = await postTransactionViaApi(user, {
            description: 'Gym membership',
            date: today,
            lines: [
                { accountId: user.accounts.food, amount: '200000' },
                { accountId: user.accounts.bank, amount: '-200000' },
            ],
        });
        const created = await api<{ data: { name: string; template: { lines: unknown[] } } }>(
            `/api/recurring/from-transaction/${posted.body.id}`,
            { method: 'POST', token: user.token, body: { name: 'Gym membership' } }
        );
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.equal(created.body.data.template.lines.length, 2);
    });
});
