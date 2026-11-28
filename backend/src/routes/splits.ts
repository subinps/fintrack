import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { badRequest, isoDateSchema, paiseSchema, parseBody, readLimiter, writeLimiter } from '../lib/validation';
import {
    addExpense,
    addMember,
    addSettlement,
    createGroup,
    deleteExpense,
    deleteGroup,
    groupDetail,
    listGroups,
    postMyShare,
    removeMember,
    updateGroup,
} from '../services/splits';
import { LedgerError } from '../services/ledger';

const router = Router();

router.use(authenticateToken);

function handleError(res: any, error: unknown) {
    if (error instanceof LedgerError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('[splits]', error);
    return res.status(500).json({ error: 'Server error', code: 'SERVER_ERROR' });
}

const memberSchema = z.object({
    name: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(160).nullish(),
});

const groupSchema = z.object({
    name: z.string().trim().min(1).max(80),
    emoji: z.string().trim().max(8).nullish(),
    members: z.array(memberSchema).max(50).optional(),
});

const groupPatchSchema = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    emoji: z.string().trim().max(8).nullish(),
});

const expenseSchema = z.object({
    description: z.string().trim().min(1).max(120),
    amountPaise: paiseSchema,
    date: isoDateSchema.optional(),
    category: z.string().trim().max(60).nullish(),
    paidById: z.string().uuid(),
    memberIds: z.array(z.string().uuid()).max(100).optional(),
    shares: z
        .array(z.object({ memberId: z.string().uuid(), amountPaise: paiseSchema }))
        .max(100)
        .optional(),
});

const settlementSchema = z.object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    amountPaise: paiseSchema,
    note: z.string().trim().max(120).nullish(),
});

const postShareSchema = z.object({ accountId: z.coerce.number().int().positive() });

router.get('/groups', readLimiter, async (req: AuthRequest, res) => {
    try {
        res.json({ data: await listGroups(req.user!.id) });
    } catch (error) {
        handleError(res, error);
    }
});

router.post('/groups', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(groupSchema, req.body);
    if (!parsed.ok) return badRequest(res, parsed.error.error, parsed.error.code, parsed.error.details);
    try {
        const group = await createGroup(req.user!.id, parsed.data);
        res.status(201).json({ data: group });
    } catch (error) {
        handleError(res, error);
    }
});

router.get('/groups/:id', readLimiter, async (req: AuthRequest, res) => {
    try {
        res.json({ data: await groupDetail(req.user!.id, req.params.id) });
    } catch (error) {
        handleError(res, error);
    }
});

router.patch('/groups/:id', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(groupPatchSchema, req.body);
    if (!parsed.ok) return badRequest(res, parsed.error.error, parsed.error.code, parsed.error.details);
    try {
        res.json({ data: await updateGroup(req.user!.id, req.params.id, parsed.data) });
    } catch (error) {
        handleError(res, error);
    }
});

router.delete('/groups/:id', writeLimiter, async (req: AuthRequest, res) => {
    try {
        await deleteGroup(req.user!.id, req.params.id);
        res.status(204).send();
    } catch (error) {
        handleError(res, error);
    }
});

router.post('/groups/:id/members', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(memberSchema, req.body);
    if (!parsed.ok) return badRequest(res, parsed.error.error, parsed.error.code, parsed.error.details);
    try {
        res.status(201).json({ data: await addMember(req.user!.id, req.params.id, parsed.data) });
    } catch (error) {
        handleError(res, error);
    }
});

router.delete('/groups/:id/members/:memberId', writeLimiter, async (req: AuthRequest, res) => {
    try {
        res.json({ data: await removeMember(req.user!.id, req.params.id, req.params.memberId) });
    } catch (error) {
        handleError(res, error);
    }
});

router.post('/groups/:id/expenses', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(expenseSchema, req.body);
    if (!parsed.ok) return badRequest(res, parsed.error.error, parsed.error.code, parsed.error.details);
    try {
        const expense = await addExpense(req.user!.id, req.params.id, {
            description: parsed.data.description,
            amountPaise: BigInt(parsed.data.amountPaise),
            date: parsed.data.date ? new Date(parsed.data.date) : undefined,
            category: parsed.data.category ?? null,
            paidById: parsed.data.paidById,
            memberIds: parsed.data.memberIds,
            shares: parsed.data.shares?.map((share) => ({
                memberId: share.memberId,
                amountPaise: BigInt(share.amountPaise),
            })),
        });
        const detail = await groupDetail(req.user!.id, req.params.id);
        res.status(201).json({ data: detail, expenseId: expense.id });
    } catch (error) {
        handleError(res, error);
    }
});

router.delete('/groups/:id/expenses/:expenseId', writeLimiter, async (req: AuthRequest, res) => {
    try {
        res.json({ data: await deleteExpense(req.user!.id, req.params.id, req.params.expenseId) });
    } catch (error) {
        handleError(res, error);
    }
});

router.post('/groups/:id/settlements', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(settlementSchema, req.body);
    if (!parsed.ok) return badRequest(res, parsed.error.error, parsed.error.code, parsed.error.details);
    try {
        res.status(201).json({
            data: await addSettlement(req.user!.id, req.params.id, {
                fromId: parsed.data.fromId,
                toId: parsed.data.toId,
                amountPaise: BigInt(parsed.data.amountPaise),
                note: parsed.data.note ?? null,
            }),
        });
    } catch (error) {
        handleError(res, error);
    }
});

router.post('/groups/:id/expenses/:expenseId/post', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(postShareSchema, req.body);
    if (!parsed.ok) return badRequest(res, parsed.error.error, parsed.error.code, parsed.error.details);
    try {
        const result = await postMyShare(req.user!.id, req.params.id, req.params.expenseId, parsed.data.accountId);
        res.status(201).json({ data: result });
    } catch (error) {
        handleError(res, error);
    }
});

export default router;
