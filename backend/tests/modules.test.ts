import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    api,
    chartOfAccounts,
    createAccount,
    createUser,
    postTransactionViaApi,
    startServer,
    stopServer,
    type TestUser,
} from './harness';

/**
 * Coverage for the modules that shipped without tests: tags, the four
 * statements, tax, investment analytics, loans and insights.
 */

let user: TestUser;

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);

before(async () => {
    await startServer();
    user = await createUser('modules');
    await chartOfAccounts(user);

    await postTransactionViaApi(user, {
        description: 'Groceries',
        date: today,
        tags: ['groceries', 'weekly'],
        lines: [
            { accountId: user.accounts.food, amount: '250000' },
            { accountId: user.accounts.bank, amount: '-250000' },
        ],
    });
    await postTransactionViaApi(user, {
        description: 'Salary',
        date: today,
        tags: ['income'],
        lines: [
            { accountId: user.accounts.bank, amount: '9000000' },
            { accountId: user.accounts.salary, amount: '-9000000' },
        ],
    });
});

after(async () => {
    await stopServer();
});

describe('transaction tags', () => {
    it('stores tags sent with a transaction', async () => {
        const list = await api('/api/transactions', { token: user.token });
        const groceries = list.body.data.find((row: any) => row.description === 'Groceries');
        assert.deepEqual(groceries.tags, ['groceries', 'weekly']);
    });

    it('normalises case and spacing', async () => {
        const created = await postTransactionViaApi(user, {
            description: 'Normalise me',
            date: today,
            tags: ['  Travel  ', 'Travel', 'Big  Trip'],
            lines: [
                { accountId: user.accounts.food, amount: '1000' },
                { accountId: user.accounts.bank, amount: '-1000' },
            ],
        });
        assert.equal(created.status, 200);
        assert.deepEqual(created.body.tags, ['travel', 'big-trip']);
    });

    it('lists distinct tags with counts and filters by one', async () => {
        const tags = await api('/api/transactions/tags', { token: user.token });
        const groceries = tags.body.data.find((tag: any) => tag.name === 'groceries');
        assert.equal(groceries.count, 1);

        const filtered = await api('/api/transactions?tag=income', { token: user.token });
        assert.equal(filtered.body.data.length, 1);
        assert.equal(filtered.body.data[0].description, 'Salary');
    });
});

describe('reports', () => {
    it('builds a profit and loss from the ledger', async () => {
        const pnl = await api(`/api/reports/pnl?from=${monthStart}&to=${today}`, { token: user.token });
        assert.equal(pnl.status, 200);
        assert.ok(Number(pnl.body.totalIncome) > 0, 'income should show the posted salary');
        const net = Number(pnl.body.netProfit);
        const income = Number(pnl.body.totalIncome);
        const expenses = Number(pnl.body.totalExpenses);
        assert.equal(Math.round((income - expenses) * 100), Math.round(net * 100));
    });

    it('balances the balance sheet', async () => {
        const sheet = await api(`/api/reports/balance-sheet?asOf=${today}`, { token: user.token });
        assert.equal(sheet.status, 200);
        assert.equal(sheet.body.balanced, true);
        assert.equal(
            Math.round(Number(sheet.body.totalAssets) * 100),
            Math.round(Number(sheet.body.totalLiabilitiesAndEquity) * 100)
        );
    });

    it('returns a trial balance that nets to zero', async () => {
        const trial = await api(`/api/reports/trial-balance?asOf=${today}`, { token: user.token });
        assert.equal(trial.status, 200);
        assert.equal(trial.body.balanced, true);
        const debit = trial.body.rows.reduce((sum: number, row: any) => sum + Number(row.debit), 0);
        const credit = trial.body.rows.reduce((sum: number, row: any) => sum + Number(row.credit), 0);
        assert.equal(Math.round(debit * 100), Math.round(credit * 100));
        assert.equal(Math.round(debit * 100), Math.round(Number(trial.body.totalDebit) * 100));
    });
});

describe('tax and insights', () => {
    it('summarises tax against the stored profile', async () => {
        const summary = await api('/api/tax/summary', { token: user.token });
        assert.equal(summary.status, 200);
        assert.equal(typeof summary.body, 'object');
        assert.ok('profile' in summary.body || 'advanceTax' in summary.body || 'deductions' in summary.body);
    });

    it('searches transactions and returns insight cards', async () => {
        const search = await api('/api/search?q=grocer', { token: user.token });
        assert.equal(search.status, 200);
        assert.ok(Array.isArray(search.body.transactions));

        const cards = await api('/api/insights', { token: user.token });
        assert.equal(cards.status, 200);
        assert.ok(Array.isArray(cards.body.insights));
    });

    it('formats insight money for reading, not as a raw number', async () => {
        const cards = await api('/api/insights', { token: user.token });
        const withMoney = cards.body.insights.filter((card: any) => /₹/.test(card.detail));
        assert.ok(withMoney.length > 0, 'at least one card quotes an amount');
        for (const card of withMoney) {
            assert.ok(!/₹\d+\.\d{2}/.test(card.detail), `raw decimal left in: ${card.detail}`);
        }
    });
});

describe('investments and loans', () => {
    it('computes holdings and gains for a priced account', async () => {
        const analytics = await api('/api/investments/analytics', { token: user.token });
        assert.equal(analytics.status, 200);
        assert.ok(Array.isArray(analytics.body.holdings));
        const fund = await createAccount(user, 'Index fund', 'ASSET', 'INVESTMENT');
        const priced = await api(`/api/accounts/${fund}`, {
            method: 'PUT',
            token: user.token,
            body: { units: 10, lastMarketPrice: 150, symbol: 'NIFTYBEES' },
        });
        assert.equal(priced.status, 200);
        const after = await api('/api/investments/analytics', { token: user.token });
        const holding = after.body.holdings.find((row: any) => row.accountId === fund);
        assert.ok(holding, 'a priced fund shows up as a holding');
        assert.equal(holding.units, 10);
        assert.equal(holding.marketValue, '1500.00');
    });

    it('lists loans and amortises a schedule', async () => {
        const loan = await createAccount(user, 'Car loan', 'LIABILITY', 'LOAN');
        const updated = await api(`/api/loans/${loan}`, {
            method: 'PATCH',
            token: user.token,
            body: { interestRate: 9.5, tenureMonths: 60, loanPrincipalPaise: '500000.00' },
        });
        assert.equal(updated.status, 200);

        const schedule = await api(`/api/loans/${loan}/schedule`, { token: user.token });
        assert.equal(schedule.status, 200);
        assert.ok(schedule.body.schedule.length > 0, 'a schedule is produced');
        assert.ok(Number(schedule.body.totalInterest) > 0, 'a priced loan accrues interest');
        const first = schedule.body.schedule[0];
        assert.ok(first && 'principal' in first && 'interest' in first);
    });
});

describe('balance sheet signs', () => {
    it('shows equity credit-positive when the ledger carries it as a debit', async () => {
        const opener = await createUser('signs');
        await chartOfAccounts(opener);
        const equity = await createAccount(opener, 'Opening Balance', 'EQUITY', 'Equity');

        const posted = await postTransactionViaApi(opener, {
            description: 'Opening balances',
            date: today,
            lines: [
                { accountId: equity, amount: '500000' },
                { accountId: opener.accounts.bank, amount: '-500000' },
            ],
        });
        assert.equal(posted.status, 200);

        const sheet = await api(`/api/reports/balance-sheet?asOf=${today}`, { token: opener.token });
        assert.equal(sheet.status, 200);
        assert.equal(sheet.body.balanced, true, 'assets must equal liabilities plus equity');

        const line = sheet.body.equity.find((row: any) => row.accountId === equity);
        assert.equal(Number(line.amount), -5000, 'equity is presented credit-positive');
        assert.equal(Number(sheet.body.totalEquity), -5000);
        assert.equal(
            Math.round(Number(sheet.body.totalAssets) * 100),
            Math.round(Number(sheet.body.totalLiabilitiesAndEquity) * 100),
        );
    });
});
