import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    api,
    chartOfAccounts,
    createUser,
    prisma,
    startServer,
    stopServer,
    type TestUser,
} from './harness';

let user: TestUser;

const SAVE_SCRIPT = `
const amount = Number(vars.amountPaise || 25000);
post('Automation savings', [
  { account: 'HDFC Bank', amount: -amount },
  { account: 'Cash', amount: amount }
]);
log('moved ' + amount);
`;

async function createAutomation(body: Record<string, unknown>) {
    return api('/api/automations', { method: 'POST', token: user.token, body });
}

before(async () => {
    await startServer();
    user = await createUser('automations');
    await chartOfAccounts(user);
});

after(async () => {
    await stopServer();
});

describe('automations', () => {
    it('creates an automation with version 1 and lists it', async () => {
        const created = await createAutomation({
            name: 'Weekly savings',
            triggerType: 'SCHEDULE',
            triggerConfig: { cron: '0 9 * * 1' },
            script: SAVE_SCRIPT,
            variables: { amountPaise: 25000 },
            isActive: true,
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.equal(created.body.data.name, 'Weekly savings');
        assert.deepEqual(created.body.data.variables, { amountPaise: 25000 });

        const detail = await api<{ data: { automation: { id: string }; versions: { version: number }[] } }>(
            `/api/automations/${created.body.data.id}`,
            { token: user.token }
        );
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.versions.length, 1);
        assert.equal(detail.body.data.versions[0].version, 1);

        const list = await api<{ data: { automations: { id: string }[] } }>('/api/automations', { token: user.token });
        assert.equal(list.status, 200);
        assert.ok(list.body.data.automations.some((row) => row.id === created.body.data.id));
    });

    it('rejects a schedule without a usable cron expression', async () => {
        const created = await createAutomation({
            name: 'Bad schedule',
            triggerType: 'SCHEDULE',
            triggerConfig: { cron: 'every monday' },
            script: SAVE_SCRIPT,
        });
        assert.equal(created.status, 400);
        assert.equal(created.body.code, 'INVALID_TRIGGER');
        assert.equal(created.body.details.field, 'triggerConfig.cron');
    });

    it('dry run reports the post without writing anything', async () => {
        const created = await createAutomation({ name: 'Dry run', script: SAVE_SCRIPT, isActive: true });
        const id = created.body.data.id as string;
        const before = await prisma.transaction.count({ where: { userId: user.id } });

        const run = await api<{ data: { status: string; transactionIds: number[]; logs: string[] } }>(
            `/api/automations/${id}/run`,
            { method: 'POST', token: user.token, body: { dryRun: true } }
        );
        assert.equal(run.status, 200, JSON.stringify(run.body));
        assert.equal(run.body.data.status, 'DRY_RUN');
        assert.equal(run.body.data.transactionIds.length, 0);
        assert.deepEqual(run.body.data.planned, [
            {
                description: 'Automation savings',
                date: new Date().toISOString().slice(0, 10),
                lines: [
                    { account: 'HDFC Bank', amountPaise: -25000 },
                    { account: 'Cash', amountPaise: 25000 },
                ],
            },
        ]);
        assert.ok(run.body.data.logs.includes('would post: Automation savings'));
        assert.deepEqual(run.body.data.logs, ['moved 25000', 'would post: Automation savings']);

        const afterCount = await prisma.transaction.count({ where: { userId: user.id } });
        assert.equal(afterCount, before, 'a dry run must not post a transaction');
    });

    it('rehearses an inactive draft with a dry run but refuses a real run', async () => {
        const created = await createAutomation({ name: 'Draft rehearsal', script: SAVE_SCRIPT, isActive: false });
        const id = created.body.data.id as string;
        const before = await prisma.transaction.count({ where: { userId: user.id } });

        const dry = await api<{ data: { status: string; planned: { description: string }[] } }>(
            `/api/automations/${id}/run`,
            { method: 'POST', token: user.token, body: { dryRun: true } }
        );
        assert.equal(dry.status, 200, JSON.stringify(dry.body));
        assert.equal(dry.body.data.status, 'DRY_RUN');
        assert.equal(dry.body.data.planned[0]?.description, 'Automation savings');

        const real = await api<{ data: { status: string; error: string | null } }>(`/api/automations/${id}/run`, {
            method: 'POST',
            token: user.token,
            body: {},
        });
        assert.equal(real.body.data.status, 'SKIPPED');
        assert.match(String(real.body.data.error), /paused/i);

        const afterCount = await prisma.transaction.count({ where: { userId: user.id } });
        assert.equal(afterCount, before, 'neither run may post a transaction');
    });

    it('every shipped template dry-runs without a sandbox error', async () => {
        const templates = await api<{
            data: { id: string; name: string; description: string; triggerType: string; triggerConfig: Record<string, unknown>; variables: Record<string, unknown>; script: string }[];
        }>('/api/automations/templates', { token: user.token });
        assert.equal(templates.status, 200);
        assert.ok(templates.body.data.length >= 3, 'expected the shipped templates');

        for (const template of templates.body.data) {
            const created = await createAutomation({
                name: template.name,
                description: template.description,
                triggerType: template.triggerType,
                triggerConfig: template.triggerConfig,
                variables: template.variables,
                script: template.script,
                isActive: false,
            });
            assert.equal(created.status, 201, JSON.stringify(created.body));

            const run = await api<{ data: { status: string; error: string | null } }>(
                `/api/automations/${created.body.data.id}/run`,
                { method: 'POST', token: user.token, body: { dryRun: true } }
            );
            assert.equal(run.body.data.status, 'DRY_RUN', `${template.name}: ${run.body.data.error}`);
            assert.equal(run.body.data.error, null, template.name);
        }
    });

    it('a real run posts a balanced transaction through the ledger', async () => {
        const created = await createAutomation({ name: 'Real run', script: SAVE_SCRIPT, isActive: true });
        const id = created.body.data.id as string;

        const run = await api<{ data: { status: string; transactionIds: number[] } }>(`/api/automations/${id}/run`, {
            method: 'POST',
            token: user.token,
            body: {},
        });
        assert.equal(run.status, 200, JSON.stringify(run.body));
        assert.equal(run.body.data.status, 'OK');
        assert.equal(run.body.data.transactionIds.length, 1);

        const transaction = await prisma.transaction.findUnique({
            where: { id: run.body.data.transactionIds[0] },
            include: { splits: true },
        });
        assert.ok(transaction);
        assert.equal(transaction.userId, user.id);
        const total = transaction.splits.reduce((sum, split) => sum + split.amount, 0n);
        assert.equal(total, 0n, 'double entry lines must sum to zero');

        const runs = await api<{ data: { status: string; isDryRun: boolean }[] }>(`/api/automations/${id}/runs`, {
            token: user.token,
        });
        assert.equal(runs.status, 200);
        assert.equal(runs.body.data[0].status, 'OK');
        assert.equal(runs.body.data[0].isDryRun, false);
    });

    it('fails an unbalanced script and records the error', async () => {
        const created = await createAutomation({
            name: 'Unbalanced',
            script: `post('Nope', [{ account: 'Cash', amount: 100 }, { account: 'HDFC Bank', amount: -50 }]);`,
            isActive: true,
        });
        const id = created.body.data.id as string;
        const run = await api<{ data: { status: string; error: string | null } }>(`/api/automations/${id}/run`, {
            method: 'POST',
            token: user.token,
            body: {},
        });
        assert.equal(run.status, 200);
        assert.equal(run.body.data.status, 'FAILED');
        assert.match(String(run.body.data.error), /sum to zero/i);
    });

    it('runs a script in a sandbox without host access', async () => {
        const created = await createAutomation({
            name: 'Sandbox escape',
            script: `log(typeof process); log(typeof require); throw new Error('done');`,
            isActive: true,
        });
        const id = created.body.data.id as string;
        const run = await api<{ data: { status: string; logs: string[]; error: string | null } }>(
            `/api/automations/${id}/run`,
            { method: 'POST', token: user.token, body: {} }
        );
        assert.equal(run.body.data.status, 'FAILED');
        assert.deepEqual(run.body.data.logs, ['undefined', 'undefined']);
        assert.match(String(run.body.data.error), /done/);
    });

    it('keeps history across edits and restores an earlier version', async () => {
        const created = await createAutomation({ name: 'Versioned', script: SAVE_SCRIPT });
        const id = created.body.data.id as string;

        const updated = await api(`/api/automations/${id}`, {
            method: 'PATCH',
            token: user.token,
            body: { script: `log('v2');` },
        });
        assert.equal(updated.status, 200, JSON.stringify(updated.body));

        const detail = await api<{ data: { versions: { id: string; version: number; script: string }[] } }>(
            `/api/automations/${id}`,
            { token: user.token }
        );
        assert.deepEqual(
            detail.body.data.versions.map((version) => version.version),
            [2, 1]
        );

        const first = detail.body.data.versions.find((version) => version.version === 1)!;
        const restored = await api<{ data: { script: string } }>(`/api/automations/${id}/versions/${first.id}/restore`, {
            method: 'POST',
            token: user.token,
        });
        assert.equal(restored.status, 200, JSON.stringify(restored.body));
        assert.equal(restored.body.data.script, SAVE_SCRIPT.trim());

        const after = await api<{ data: { versions: { version: number }[] } }>(`/api/automations/${id}`, {
            token: user.token,
        });
        assert.equal(after.body.data.versions[0].version, 3);
    });

    it('the kill switch stops every automation of the user', async () => {
        const created = await createAutomation({ name: 'Paused run', script: SAVE_SCRIPT, isActive: true });
        const id = created.body.data.id as string;

        const paused = await api('/api/automations/settings', { method: 'PATCH', token: user.token, body: { paused: true } });
        assert.equal(paused.status, 200);

        const run = await api<{ data: { status: string; error: string | null } }>(`/api/automations/${id}/run`, {
            method: 'POST',
            token: user.token,
            body: {},
        });
        assert.equal(run.body.data.status, 'SKIPPED');
        assert.match(String(run.body.data.error), /paused/i);

        await api('/api/automations/settings', { method: 'PATCH', token: user.token, body: { paused: false } });
    });

    it('archived automations disappear from the list and cannot run', async () => {
        const created = await createAutomation({ name: 'Archived', script: SAVE_SCRIPT });
        const id = created.body.data.id as string;

        const deleted = await api(`/api/automations/${id}`, { method: 'DELETE', token: user.token });
        assert.equal(deleted.status, 200);

        const list = await api<{ data: { automations: { id: string }[] } }>('/api/automations', { token: user.token });
        assert.ok(!list.body.data.automations.some((row) => row.id === id));

        const run = await api(`/api/automations/${id}/run`, { method: 'POST', token: user.token, body: {} });
        assert.equal(run.status, 404);
    });

    it('webhook triggers need the automation key', async () => {
        const created = await createAutomation({
            name: 'Webhook',
            triggerType: 'WEBHOOK',
            triggerConfig: {},
            script: `log('hook ' + event.type);`,
            isActive: true,
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const id = created.body.data.id as string;
        const secret = created.body.data.webhookSecret as string;
        assert.ok(secret && secret.length > 20, 'a webhook automation issues one key');

        const denied = await api(`/api/automations/hooks/${id}`, {
            method: 'POST',
            body: {},
            headers: { 'x-automation-key': 'wrong-key' },
        });
        assert.equal(denied.status, 401);

        const allowed = await api<{ data: { status: string; logs: string[] } }>(`/api/automations/hooks/${id}`, {
            method: 'POST',
            body: {},
            headers: { 'x-automation-key': secret },
        });
        assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
        assert.equal(allowed.body.data.status, 'OK');
    });

    it('never returns stored secrets back to the client', async () => {
        const created = await createAutomation({
            name: 'With secret',
            script: `log(secrets.apiKey ? 'yes' : 'no');`,
            isActive: true,
            secrets: { apiKey: 'super-secret-value' },
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.deepEqual(created.body.data.secretKeys, ['apiKey']);
        assert.ok(!JSON.stringify(created.body).includes('super-secret-value'));

        const detail = await api(`/api/automations/${created.body.data.id}`, { token: user.token });
        assert.ok(!JSON.stringify(detail.body).includes('super-secret-value'));

        const run = await api<{ data: { logs: string[] } }>(`/api/automations/${created.body.data.id}/run`, {
            method: 'POST',
            token: user.token,
            body: {},
        });
        assert.deepEqual(run.body.data.logs, ['yes']);
    });

    it('does not leak another user\u2019s automation', async () => {
        const other = await createUser('automations-other');
        const created = await createAutomation({ name: 'Mine', script: SAVE_SCRIPT });
        const id = created.body.data.id as string;

        const read = await api(`/api/automations/${id}`, { token: other.token });
        assert.equal(read.status, 404);
        const run = await api(`/api/automations/${id}/run`, { method: 'POST', token: other.token, body: {} });
        assert.equal(run.status, 404);
    });
});
