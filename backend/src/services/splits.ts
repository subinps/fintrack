import { prisma } from '../lib/prisma';
import { LedgerError, postTransaction } from './ledger';

/**
 * Phase 8: shared expenses. Balances and settle-up plans are derived on every
 * read from expenses, shares and settlements — nothing is cached, so an edit
 * can never leave a group with stale money.
 */

export interface MemberBalance {
    id: string;
    name: string;
    email: string | null;
    isMe: boolean;
    paidPaise: string;
    owedPaise: string;
    settledPaise: string;
    netPaise: string;
}

export interface Transfer {
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    amountPaise: string;
}

const toBig = (value: bigint | string | number): bigint => BigInt(value as bigint);

export function splitEqually(amountPaise: bigint, count: number): bigint[] {
    if (count <= 0) return [];
    const base = amountPaise / BigInt(count);
    const remainder = amountPaise - base * BigInt(count);
    return Array.from({ length: count }, (_, index) => base + (BigInt(index) < remainder ? 1n : 0n));
}

/** Greedy creditor/debtor matching: at most n-1 transfers, always exact. */
export function settlePlan(balances: { id: string; name: string; netPaise: bigint }[]): Transfer[] {
    const debtors = balances
        .filter((member) => member.netPaise < 0n)
        .map((member) => ({ ...member, remaining: -member.netPaise }))
        .sort((a, b) => Number(b.remaining - a.remaining));
    const creditors = balances
        .filter((member) => member.netPaise > 0n)
        .map((member) => ({ ...member, remaining: member.netPaise }))
        .sort((a, b) => Number(b.remaining - a.remaining));

    const transfers: Transfer[] = [];
    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
        const debtor = debtors[debtorIndex];
        const creditor = creditors[creditorIndex];
        const amount = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining;
        if (amount > 0n) {
            transfers.push({
                fromId: debtor.id,
                fromName: debtor.name,
                toId: creditor.id,
                toName: creditor.name,
                amountPaise: amount.toString(),
            });
            debtor.remaining -= amount;
            creditor.remaining -= amount;
        }
        if (debtor.remaining === 0n) debtorIndex += 1;
        if (creditor.remaining === 0n) creditorIndex += 1;
    }
    return transfers;
}

export function balancesFor(
    members: { id: string; name: string; email: string | null; isMe: boolean }[],
    expenses: { paidById: string; amountPaise: bigint; shares: { memberId: string; amountPaise: bigint }[] }[],
    settlements: { fromId: string; toId: string; amountPaise: bigint }[]
): MemberBalance[] {
    const rows = new Map(
        members.map((member) => [
            member.id,
            { ...member, paid: 0n, owed: 0n, sent: 0n, received: 0n },
        ])
    );

    for (const expense of expenses) {
        const payer = rows.get(expense.paidById);
        if (payer) payer.paid += expense.amountPaise;
        for (const share of expense.shares) {
            const row = rows.get(share.memberId);
            if (row) row.owed += share.amountPaise;
        }
    }
    for (const settlement of settlements) {
        const from = rows.get(settlement.fromId);
        const to = rows.get(settlement.toId);
        if (from) from.sent += settlement.amountPaise;
        if (to) to.received += settlement.amountPaise;
    }

    return members.map((member) => {
        const row = rows.get(member.id)!;
        // Paying someone back moves both of you towards zero: sent raises your net, received lowers it.
        const net = row.paid - row.owed + row.sent - row.received;
        return {
            id: member.id,
            name: member.name,
            email: member.email,
            isMe: member.isMe,
            paidPaise: row.paid.toString(),
            owedPaise: row.owed.toString(),
            settledPaise: (row.sent - row.received).toString(),
            netPaise: net.toString(),
        };
    });
}

async function ownedGroup(userId: string, groupId: string) {
    const group = await prisma.splitGroup.findFirst({ where: { id: groupId, userId } });
    if (!group) throw new LedgerError(404, 'GROUP_NOT_FOUND', 'That split group does not exist');
    return group;
}

export async function listGroups(userId: string) {
    const groups = await prisma.splitGroup.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: {
            members: true,
            expenses: { include: { shares: true } },
            settlements: true,
        },
    });

    return groups.map((group) => {
        const balances = balancesFor(group.members, group.expenses, group.settlements);
        const me = balances.find((member) => member.isMe);
        return {
            id: group.id,
            name: group.name,
            emoji: group.emoji,
            memberCount: group.members.length,
            expenseCount: group.expenses.length,
            totalPaise: group.expenses.reduce((sum, expense) => sum + expense.amountPaise, 0n).toString(),
            myNetPaise: me?.netPaise ?? '0',
            updatedAt: group.updatedAt,
        };
    });
}

export async function groupDetail(userId: string, groupId: string) {
    const group = await prisma.splitGroup.findFirst({
        where: { id: groupId, userId },
        include: {
            members: { orderBy: { createdAt: 'asc' } },
            expenses: {
                include: { shares: true, paidBy: true },
                orderBy: { date: 'desc' },
            },
            settlements: { orderBy: { date: 'desc' } },
        },
    });
    if (!group) throw new LedgerError(404, 'GROUP_NOT_FOUND', 'That split group does not exist');

    const balances = balancesFor(group.members, group.expenses, group.settlements);
    const transfers = settlePlan(
        balances.map((member) => ({ id: member.id, name: member.name, netPaise: toBig(member.netPaise) }))
    );

    return {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        members: balances,
        transfers,
        totalPaise: group.expenses.reduce((sum, expense) => sum + expense.amountPaise, 0n).toString(),
        expenses: group.expenses.map((expense) => ({
            id: expense.id,
            description: expense.description,
            amountPaise: expense.amountPaise.toString(),
            date: expense.date,
            category: expense.category,
            paidById: expense.paidById,
            paidByName: expense.paidBy.name,
            transactionId: expense.transactionId,
            shares: expense.shares.map((share) => ({
                memberId: share.memberId,
                amountPaise: share.amountPaise.toString(),
            })),
        })),
        settlements: group.settlements.map((settlement) => ({
            id: settlement.id,
            fromId: settlement.fromId,
            toId: settlement.toId,
            amountPaise: settlement.amountPaise.toString(),
            date: settlement.date,
            note: settlement.note,
        })),
    };
}

export async function createGroup(
    userId: string,
    input: { name: string; emoji?: string | null; members?: { name: string; email?: string | null }[] }
) {
    const extraMembers = (input.members ?? []).filter((member) => member.name.trim());
    const created = await prisma.splitGroup.create({
        data: {
            userId,
            name: input.name.trim(),
            emoji: input.emoji ?? null,
            members: {
                create: [
                    { name: 'You', isMe: true },
                    ...extraMembers.map((member) => ({
                        name: member.name.trim(),
                        email: member.email ?? null,
                    })),
                ],
            },
        },
    });
    return groupDetail(userId, created.id);
}

export async function updateGroup(
    userId: string,
    groupId: string,
    input: { name?: string; emoji?: string | null }
) {
    await ownedGroup(userId, groupId);
    await prisma.splitGroup.update({
        where: { id: groupId },
        data: {
            name: input.name?.trim() || undefined,
            emoji: input.emoji === undefined ? undefined : input.emoji,
        },
    });
    return groupDetail(userId, groupId);
}

export async function deleteGroup(userId: string, groupId: string) {
    await ownedGroup(userId, groupId);
    await prisma.splitGroup.delete({ where: { id: groupId } });
}

export async function addMember(
    userId: string,
    groupId: string,
    input: { name: string; email?: string | null }
) {
    await ownedGroup(userId, groupId);
    await prisma.splitMember.create({
        data: { groupId, name: input.name.trim(), email: input.email ?? null },
    });
    return groupDetail(userId, groupId);
}

export async function removeMember(userId: string, groupId: string, memberId: string) {
    await ownedGroup(userId, groupId);
    const member = await prisma.splitMember.findFirst({ where: { id: memberId, groupId } });
    if (!member) throw new LedgerError(404, 'MEMBER_NOT_FOUND', 'That member is not in this group');
    if (member.isMe) throw new LedgerError(400, 'CANNOT_REMOVE_OWNER', 'The group owner cannot be removed');
    const shareCount = await prisma.splitShare.count({ where: { memberId } });
    if (shareCount > 0) {
        throw new LedgerError(
            409,
            'MEMBER_HAS_SHARES',
            'This member is on existing expenses — remove those expenses first'
        );
    }
    await prisma.splitMember.delete({ where: { id: memberId } });
    return groupDetail(userId, groupId);
}

export async function addExpense(
    userId: string,
    groupId: string,
    input: {
        description: string;
        amountPaise: bigint;
        date?: Date;
        category?: string | null;
        paidById: string;
        memberIds?: string[];
        shares?: { memberId: string; amountPaise: bigint }[];
    }
) {
    await ownedGroup(userId, groupId);
    if (input.amountPaise <= 0n) {
        throw new LedgerError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }

    const members = await prisma.splitMember.findMany({ where: { groupId } });
    const memberIds = new Set(members.map((member) => member.id));
    if (!memberIds.has(input.paidById)) {
        throw new LedgerError(400, 'UNKNOWN_PAYER', 'Whoever paid must be a member of this group');
    }

    let shares: { memberId: string; amountPaise: bigint }[];
    if (input.shares && input.shares.length > 0) {
        for (const share of input.shares) {
            if (!memberIds.has(share.memberId)) {
                throw new LedgerError(400, 'UNKNOWN_MEMBER', 'A share belongs to someone outside this group');
            }
        }
        const total = input.shares.reduce((sum, share) => sum + share.amountPaise, 0n);
        if (total !== input.amountPaise) {
            throw new LedgerError(
                400,
                'SHARES_DO_NOT_ADD_UP',
                `Shares add up to ${total} but the expense is ${input.amountPaise}`
            );
        }
        shares = input.shares;
    } else {
        const participants = (input.memberIds?.length ? input.memberIds : members.map((m) => m.id)).filter((id) =>
            memberIds.has(id)
        );
        if (participants.length === 0) {
            throw new LedgerError(400, 'NO_PARTICIPANTS', 'Pick at least one person to split with');
        }
        const parts = splitEqually(input.amountPaise, participants.length);
        shares = participants.map((memberId, index) => ({ memberId, amountPaise: parts[index] }));
    }

    const expense = await prisma.splitExpense.create({
        data: {
            groupId,
            description: input.description.trim(),
            amountPaise: input.amountPaise,
            date: input.date ?? new Date(),
            category: input.category ?? null,
            paidById: input.paidById,
            shares: { create: shares },
        },
    });
    await prisma.splitGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
    return expense;
}

export async function deleteExpense(userId: string, groupId: string, expenseId: string) {
    await ownedGroup(userId, groupId);
    const expense = await prisma.splitExpense.findFirst({ where: { id: expenseId, groupId } });
    if (!expense) throw new LedgerError(404, 'EXPENSE_NOT_FOUND', 'That expense is not in this group');
    if (expense.transactionId) {
        throw new LedgerError(
            409,
            'EXPENSE_POSTED',
            'Your share is already in your ledger — delete that transaction first'
        );
    }
    await prisma.splitExpense.delete({ where: { id: expenseId } });
    return groupDetail(userId, groupId);
}

export async function addSettlement(
    userId: string,
    groupId: string,
    input: { fromId: string; toId: string; amountPaise: bigint; note?: string | null }
) {
    await ownedGroup(userId, groupId);
    if (input.amountPaise <= 0n) {
        throw new LedgerError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }
    if (input.fromId === input.toId) {
        throw new LedgerError(400, 'SAME_MEMBER', 'A settlement needs two different people');
    }
    const count = await prisma.splitMember.count({
        where: { groupId, id: { in: [input.fromId, input.toId] } },
    });
    if (count !== 2) throw new LedgerError(400, 'UNKNOWN_MEMBER', 'Both people must be in this group');

    await prisma.splitSettlement.create({
        data: {
            groupId,
            fromId: input.fromId,
            toId: input.toId,
            amountPaise: input.amountPaise,
            note: input.note ?? null,
        },
    });
    return groupDetail(userId, groupId);
}

/**
 * Posts only the owner's share of an expense into their own ledger, so shared
 * spending reaches the books without importing the whole group.
 */
export async function postMyShare(userId: string, groupId: string, expenseId: string, accountId: number) {
    await ownedGroup(userId, groupId);
    const expense = await prisma.splitExpense.findFirst({
        where: { id: expenseId, groupId },
        include: { shares: true, paidBy: true },
    });
    if (!expense) throw new LedgerError(404, 'EXPENSE_NOT_FOUND', 'That expense is not in this group');
    if (expense.transactionId) {
        throw new LedgerError(409, 'ALREADY_POSTED', 'This share is already in your ledger');
    }

    const me = await prisma.splitMember.findFirst({ where: { groupId, isMe: true } });
    if (!me) throw new LedgerError(400, 'NO_OWNER', 'This group has no owner member');
    const myShare = expense.shares.find((share) => share.memberId === me.id);
    if (!myShare) {
        throw new LedgerError(400, 'NOT_INVOLVED', 'You have no share in this expense');
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new LedgerError(404, 'ACCOUNT_NOT_FOUND', 'That account does not exist');

    const namedExpense = expense.category
        ? await prisma.account.findFirst({
              where: { userId, type: 'EXPENSE', name: { equals: expense.category, mode: 'insensitive' } },
          })
        : null;
    const fallback = namedExpense
        ? null
        : await prisma.account.findFirst({ where: { userId, type: 'EXPENSE' }, orderBy: { id: 'asc' } });
    const toAccountId = namedExpense?.id ?? fallback?.id;
    if (!toAccountId) {
        throw new LedgerError(400, 'NO_EXPENSE_ACCOUNT', 'Add an expense account before posting a share');
    }

    const posted = await postTransaction({
        userId,
        description: `Shared: ${expense.description}`,
        date: expense.date,
        lines: [
            { accountId: toAccountId, amount: myShare.amountPaise },
            { accountId, amount: -myShare.amountPaise },
        ],
        tags: ['split'],
    });

    await prisma.splitExpense.update({
        where: { id: expense.id },
        data: { transactionId: posted.id },
    });

    return { transactionId: posted.id, amountPaise: myShare.amountPaise.toString() };
}
