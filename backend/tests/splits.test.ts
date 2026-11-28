import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api, chartOfAccounts, createUser, startServer, stopServer, type TestUser } from './harness';

/**
 * Phase 8: shared expenses. Balances are derived, so every assertion here works
 * from the API response rather than from stored totals.
 */

let user: TestUser;
let other: TestUser;

const today = new Date().toISOString().slice(0, 10);

async function createGroup(token: string, body: Record<string, unknown>) {
    return api('/api/splits/groups', { method: 'POST', token, body });
}

before(async () => {
    await startServer();
    user = await createUser('splits');
    await chartOfAccounts(user);
    other = await createUser('splits-other');
});

after(async () => {
    await stopServer();
});

describe('split groups', () => {
    it('creates a group with the owner first and extra people after', async () => {
        const created = await createGroup(user.token, {
            name: 'Flat 4B',
            emoji: '🏠',
            members: [{ name: 'Aditi' }, { name: 'Rohan' }],
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.data.name, 'Flat 4B');
        assert.equal(created.body.data.members.length, 3);
        assert.equal(created.body.data.members[0].isMe, true);
        assert.equal(created.body.data.members[0].name, 'You');
    });

    it('rejects a group with no name', async () => {
        const created = await createGroup(user.token, { name: '   ' });
        assert.equal(created.status, 400);
    });

    it('does not let another user read a group', async () => {
        const created = await createGroup(user.token, { name: 'Private' });
        const peek = await api(`/api/splits/groups/${created.body.data.id}`, { token: other.token });
        assert.equal(peek.status, 404);
    });
});

describe('expense splitting', () => {
    let groupId: string;
    let me: string;
    let aditi: string;
    let rohan: string;

    before(async () => {
        const created = await createGroup(user.token, {
            name: 'Goa trip',
            members: [{ name: 'Aditi' }, { name: 'Rohan' }],
        });
        groupId = created.body.data.id;
        const members = created.body.data.members;
        me = members.find((member: any) => member.isMe).id;
        aditi = members.find((member: any) => member.name === 'Aditi').id;
        rohan = members.find((member: any) => member.name === 'Rohan').id;
    });

    it('splits an expense equally and derives balances', async () => {
        const added = await api(`/api/splits/groups/${groupId}/expenses`, {
            method: 'POST',
            token: user.token,
            body: {
                description: 'Beach shack lunch',
                amountPaise: '90000',
                paidById: me,
                memberIds: [me, aditi, rohan],
            },
        });
        assert.equal(added.status, 201);

        const balances = added.body.data.members;
        const mine = balances.find((member: any) => member.id === me);
        assert.equal(mine.paidPaise, '90000');
        assert.equal(mine.owedPaise, '30000');
        // I paid 900 and own 300, so two people owe me 300 each.
        assert.equal(mine.netPaise, '60000');
        assert.equal(added.body.data.transfers.length, 2);
        const total = added.body.data.transfers.reduce((sum: bigint, transfer: any) => sum + BigInt(transfer.amountPaise), 0n);
        assert.equal(total, 60000n);
    });

    it('keeps everyone in balance when the amount does not divide evenly', async () => {
        const added = await api(`/api/splits/groups/${groupId}/expenses`, {
            method: 'POST',
            token: user.token,
            body: {
                description: 'Cab',
                amountPaise: '10000',
                paidById: aditi,
                memberIds: [me, aditi, rohan],
            },
        });
        assert.equal(added.status, 201);
        const expense = added.body.data.expenses.find((row: any) => row.description === 'Cab');
        const shareTotal = expense.shares.reduce((sum: bigint, share: any) => sum + BigInt(share.amountPaise), 0n);
        assert.equal(shareTotal, 10000n, 'shares must add up to the expense exactly');
    });

    it('refuses shares that do not add up to the expense', async () => {
        const bad = await api(`/api/splits/groups/${groupId}/expenses`, {
            method: 'POST',
            token: user.token,
            body: {
                description: 'Broken',
                amountPaise: '10000',
                paidById: me,
                shares: [{ memberId: me, amountPaise: '4000' }],
            },
        });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.code, 'SHARES_DO_NOT_ADD_UP');
    });

    it('refuses a payer who is not in the group', async () => {
        const bad = await api(`/api/splits/groups/${groupId}/expenses`, {
            method: 'POST',
            token: user.token,
            body: {
                description: 'Stranger',
                amountPaise: '10000',
                paidById: '11111111-1111-4111-8111-111111111111',
                memberIds: [me],
            },
        });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.code, 'UNKNOWN_PAYER');
    });

    it('clears a balance once the payment is recorded', async () => {
        const before = await api(`/api/splits/groups/${groupId}`, { token: user.token });
        const plan = before.body.data.transfers[0];
        const settled = await api(`/api/splits/groups/${groupId}/settlements`, {
            method: 'POST',
            token: user.token,
            body: { fromId: plan.fromId, toId: plan.toId, amountPaise: plan.amountPaise },
        });
        assert.equal(settled.status, 201);
        const after = settled.body.data.transfers;
        const settledPaise = BigInt(plan.amountPaise);
        const outstanding = after.reduce((sum: bigint, transfer: any) => sum + BigInt(transfer.amountPaise), 0n);
        const previous = before.body.data.transfers.reduce(
            (sum: bigint, transfer: any) => sum + BigInt(transfer.amountPaise),
            0n
        );
        assert.equal(previous - outstanding, settledPaise, 'settling removes exactly the amount paid');
        assert.ok(
            after.every((transfer: any) => !(transfer.fromId === plan.fromId && transfer.toId === plan.toId)),
            'the settled pair no longer owes anything'
        );
    });

    it('posts only my share into my own ledger', async () => {
        const detail = await api(`/api/splits/groups/${groupId}`, { token: user.token });
        const target = detail.body.data.expenses.find((expense: any) => !expense.transactionId);
        assert.ok(target, 'there is an expense with no posted share');

        const posted = await api(`/api/splits/groups/${groupId}/expenses/${target.id}/post`, {
            method: 'POST',
            token: user.token,
            body: { accountId: user.accounts.bank },
        });
        assert.equal(posted.status, 201);
        const myShare = target.shares.find((share: any) => share.memberId === me);
        assert.equal(posted.body.data.amountPaise, myShare.amountPaise);

        const again = await api(`/api/splits/groups/${groupId}/expenses/${target.id}/post`, {
            method: 'POST',
            token: user.token,
            body: { accountId: user.accounts.bank },
        });
        assert.equal(again.status, 409);
        assert.equal(again.body.code, 'ALREADY_POSTED');
    });

    it('will not remove a member who is on an expense', async () => {
        const removed = await api(`/api/splits/groups/${groupId}/members/${aditi}`, {
            method: 'DELETE',
            token: user.token,
        });
        assert.equal(removed.status, 409);
        assert.equal(removed.body.code, 'MEMBER_HAS_SHARES');
    });
});
