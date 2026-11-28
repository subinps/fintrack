import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { api, chartOfAccounts, createUser, prisma, postTransactionViaApi, startServer, stopServer, type TestUser, BASE_URL } from './harness';

let user: TestUser;
let other: TestUser;

interface McpHandle {
    client: Client;
    close: () => Promise<void>;
}

async function connect(token: string): Promise<McpHandle> {
    const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    const client = new Client({ name: 'fintrack-test', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    return {
        client,
        close: async () => {
            await client.close().catch(() => undefined);
        },
    };
}

function textOf(result: any): Record<string, any> {
    const content = result?.content ?? [];
    const text = content.find((part: any) => part.type === 'text')?.text ?? '{}';
    return JSON.parse(text);
}

async function createToken(body: Record<string, unknown> = {}): Promise<{ token: string; id: string; response: any }> {
    const response = await api('/api/mcp/tokens', {
        method: 'POST',
        token: user.token,
        body: { name: 'Claude test', scopes: ['read', 'write:transactions'], writeMode: 'DRAFT', ...body },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return { token: response.body.data.token, id: response.body.data.id, response };
}

before(async () => {
    await startServer();
    user = await createUser('mcp');
    await chartOfAccounts(user);
    other = await createUser('mcp-other');
    await chartOfAccounts(other);
});

after(async () => {
    await stopServer();
});

describe('mcp tokens', () => {
    it('issues a token once, stores only its hash and lists it without the secret', async () => {
        const issued = await createToken();
        assert.match(issued.token, /^ft_pat_/);
        assert.equal(issued.response.body.data.setup.url.endsWith('/mcp'), true);

        const stored = await prisma.personalAccessToken.findUnique({ where: { id: issued.id } });
        assert.ok(stored);
        assert.notEqual(stored!.tokenHash, issued.token);
        assert.equal(stored!.tokenHash.length, 64);

        const list = await api('/api/mcp/tokens', { token: user.token });
        const entry = list.body.data.find((row: any) => row.id === issued.id);
        assert.ok(entry);
        assert.equal(entry.token, undefined);
        assert.equal(entry.prefix, issued.response.body.data.prefix);
    });

    it('rejects requests without a valid token', async () => {
        const response = await fetch(`${BASE_URL}/mcp`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        assert.equal(response.status, 401);

        const bogus = await fetch(`${BASE_URL}/mcp`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ft_pat_not-a-real-token' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        assert.equal(bogus.status, 401);
    });
});

describe('mcp tools', () => {
    it('advertises the read and write tool surface', async () => {
        const { token } = await createToken();
        const handle = await connect(token);
        try {
            const tools = await handle.client.listTools();
            const names = tools.tools.map((tool) => tool.name);
            for (const expected of [
                'list_accounts',
                'search_transactions',
                'profit_loss',
                'budget_status',
                'safe_to_spend',
                'quick_add_expense',
                'create_transaction',
                'create_recurring',
                'list_drafts',
            ]) {
                assert.equal(names.includes(expected), true, `missing tool ${expected}`);
            }
            assert.equal(tools.tools.length >= 20, true);
        } finally {
            await handle.close();
        }
    });

    it('reads accounts and a balanced trial balance', async () => {
        const { token } = await createToken();
        const handle = await connect(token);
        try {
            const accounts = textOf(await handle.client.callTool({ name: 'list_accounts', arguments: {} }));
            assert.equal(accounts.accounts.length > 0, true);
            const food = accounts.accounts.find((account: any) => account.name === 'Food');
            assert.ok(food);

            const trial = textOf(await handle.client.callTool({ name: 'trial_balance', arguments: {} }));
            assert.equal(trial.balanced, true);
            assert.equal(trial.totalDebitPaise, trial.totalCreditPaise);

            const worth = textOf(await handle.client.callTool({ name: 'get_net_worth', arguments: {} }));
            assert.equal(typeof worth.netWorthPaise, 'string');
        } finally {
            await handle.close();
        }
    });

    it('creates a draft spend that appears in list_drafts and the audit log', async () => {
        const { token } = await createToken();
        const handle = await connect(token);
        try {
            const created = textOf(
                await handle.client.callTool({
                    name: 'quick_add_expense',
                    arguments: { amount: 450.5, category: 'Food', paid_from: 'HDFC Bank', description: 'Team lunch' },
                })
            );
            assert.ok(created.id, JSON.stringify(created));
            assert.equal(created.status, 'DRAFT');

            const drafts = textOf(await handle.client.callTool({ name: 'list_drafts', arguments: {} }));
            assert.equal(drafts.drafts.some((draft: any) => draft.id === created.id), true);

            const stored = await prisma.transaction.findUnique({ where: { id: created.id }, include: { splits: true } });
            assert.equal(stored!.status, 'DRAFT');
            assert.equal(stored!.source, 'MCP');
            const total = stored!.splits.reduce((sum, split) => sum + split.amount, 0n);
            assert.equal(total, 0n);
            assert.equal(stored!.splits.some((split) => split.amount === 45050n), true);

            const audit = await api('/api/mcp/audit', { token: user.token });
            const entry = audit.body.data.find((row: any) => row.tool === 'quick_add_expense' && row.summary?.includes('45050'));
            assert.ok(entry, 'expected an audit row for the write');
            assert.equal(entry.status, 'OK');
        } finally {
            await handle.close();
        }
    });

    it('honours dry runs without writing anything', async () => {
        const { token } = await createToken();
        const handle = await connect(token);
        const before = await prisma.transaction.count({ where: { userId: user.id } });
        try {
            const preview = textOf(
                await handle.client.callTool({
                    name: 'quick_add_expense',
                    arguments: { amount: 99, category: 'Food', dry_run: true },
                })
            );
            assert.equal(preview.dryRun, true);
            assert.equal(preview.wouldCreate.status, 'DRAFT');
            const after = await prisma.transaction.count({ where: { userId: user.id } });
            assert.equal(after, before);
        } finally {
            await handle.close();
        }
    });

    it('blocks writes from a read-only token and records the denial', async () => {
        const { token } = await createToken({ name: 'Read only', scopes: ['read'] });
        const handle = await connect(token);
        try {
            const result: any = await handle.client.callTool({
                name: 'quick_add_expense',
                arguments: { amount: 100, category: 'Food' },
            });
            assert.equal(result.isError, true);
            const parsed = textOf(result);
            assert.equal(parsed.code, 'SCOPE_DENIED');

            const audit = await api('/api/mcp/audit', { token: user.token });
            assert.equal(audit.body.data.some((row: any) => row.status === 'DENIED'), true);
        } finally {
            await handle.close();
        }
    });

    it('posts directly when the token is allowed to', async () => {
        const { token } = await createToken({ name: 'Direct', writeMode: 'DIRECT' });
        const handle = await connect(token);
        try {
            const created = textOf(
                await handle.client.callTool({
                    name: 'quick_add_expense',
                    arguments: { amount: 120, category: 'Food', description: 'Direct coffee' },
                })
            );
            assert.equal(created.status, 'COMPLETED');
            const stored = await prisma.transaction.findUnique({ where: { id: created.id } });
            assert.equal(stored!.status, 'COMPLETED');
        } finally {
            await handle.close();
        }
    });

    it('stops working after the token is revoked', async () => {
        const { token, id } = await createToken({ name: 'Short lived' });
        const handle = await connect(token);
        await handle.close();

        const revoked = await api(`/api/mcp/tokens/${id}`, { method: 'DELETE', token: user.token });
        assert.equal(revoked.status, 200);

        const response = await fetch(`${BASE_URL}/mcp`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        assert.equal(response.status, 401);
    });

    it('cannot read another user’s transaction', async () => {
        const otherSpend = await postTransactionViaApi(other, {
            description: 'Other user lunch',
            date: new Date().toISOString().slice(0, 10),
            lines: [
                { accountId: other.accounts.food, amount: '5000' },
                { accountId: other.accounts.bank, amount: '-5000' },
            ],
        });
        assert.equal(otherSpend.status, 200, JSON.stringify(otherSpend.body));
        const otherTx = await prisma.transaction.findFirst({
            where: { userId: other.id },
            orderBy: { id: 'desc' },
            select: { id: true },
        });
        assert.ok(otherTx);

        const { token } = await createToken();
        const handle = await connect(token);
        try {
            const result: any = await handle.client.callTool({
                name: 'get_transaction',
                arguments: { id: otherTx.id },
            });
            assert.equal(result.isError, true);
            assert.match(textOf(result).error, /not found/i);
        } finally {
            await handle.close();
        }
    });
});
