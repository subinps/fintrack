import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { badRequest, parseBody, readLimiter, writeLimiter } from '../lib/validation';
import { issueToken } from '../services/tokens';

const router = Router();

router.use(authenticateToken);

const scopesSchema = z.array(z.enum(['read', 'write:transactions'])).min(1).max(2);

const createTokenSchema = z.object({
    name: z.string().trim().min(1).max(60),
    scopes: scopesSchema.default(['read']),
    writeMode: z.enum(['DRAFT', 'DIRECT']).default('DRAFT'),
    accountAllowList: z.array(z.coerce.number().int().positive()).max(50).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
});

function publicSnippet(url: string, token: string) {
    return {
        url,
        claudeDesktop: {
            mcpServers: {
                fintrack: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } },
            },
        },
        claudeCode: `claude mcp add --transport http fintrack ${url} --header "Authorization: Bearer ${token}"`,
        generic: { transport: 'streamable-http', headers: { Authorization: `Bearer ${token}` } },
    };
}

function requestOrigin(req: AuthRequest) {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
    const proto = (String(req.headers['x-forwarded-proto'] ?? '').split(',')[0] || req.protocol).trim();
    const host = (String(req.headers['x-forwarded-host'] ?? '').split(',')[0] || req.get('host') || 'localhost:3005').trim();
    return `${proto}://${host}`;
}

router.get('/tokens', readLimiter, async (req: AuthRequest, res) => {
    const tokens = await prisma.personalAccessToken.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            prefix: true,
            scopes: true,
            writeMode: true,
            accountAllowList: true,
            expiresAt: true,
            revokedAt: true,
            lastUsedAt: true,
            createdAt: true,
        },
    });
    res.json({ data: tokens });
});

router.post('/tokens', writeLimiter, async (req: AuthRequest, res) => {
    const parsed = parseBody(createTokenSchema, req.body);
    if (!parsed.ok) return res.status(400).json(parsed.error);

    if (parsed.data.accountAllowList?.length) {
        const owned = await prisma.account.count({ where: { userId: req.user!.id, id: { in: parsed.data.accountAllowList } } });
        if (owned !== parsed.data.accountAllowList.length) return badRequest(res, 'One of the accounts does not belong to you', 'ACCOUNT_NOT_FOUND');
    }

    const issued = issueToken();
    const expiresAt = parsed.data.expiresInDays ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000) : null;

    const created = await prisma.personalAccessToken.create({
        data: {
            userId: req.user!.id,
            name: parsed.data.name,
            prefix: issued.prefix,
            tokenHash: issued.tokenHash,
            scopes: parsed.data.scopes,
            writeMode: parsed.data.writeMode,
            accountAllowList: parsed.data.accountAllowList ?? [],
            expiresAt,
        },
    });

    const origin = requestOrigin(req);
    res.status(201).json({
        data: {
            id: created.id,
            name: created.name,
            prefix: created.prefix,
            scopes: created.scopes,
            writeMode: created.writeMode,
            expiresAt: created.expiresAt,
            token: issued.token,
            setup: publicSnippet(`${origin}/mcp`, issued.token),
        },
    });
});

router.delete('/tokens/:id', writeLimiter, async (req: AuthRequest, res) => {
    const token = await prisma.personalAccessToken.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!token) return res.status(404).json({ error: 'Token not found', code: 'TOKEN_NOT_FOUND' });
    await prisma.personalAccessToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
    res.json({ data: { ok: true } });
});

router.get('/audit', readLimiter, async (req: AuthRequest, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
    const logs = await prisma.mcpAuditLog.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { token: { select: { name: true, prefix: true } } },
    });
    res.json({
        data: logs.map((log) => ({
            id: log.id,
            tool: log.tool,
            status: log.status,
            summary: log.summary,
            error: log.error,
            durationMs: log.durationMs,
            tokenName: log.token?.name ?? null,
            createdAt: log.createdAt.toISOString(),
        })),
    });
});

router.get('/setup', readLimiter, async (req: AuthRequest, res) => {
    const origin = requestOrigin(req);
    res.json({
        data: {
            url: `${origin}/mcp`,
            transport: 'streamable-http',
            auth: 'Bearer token created in Settings › Connect to AI',
            tools: [
                { name: 'list_accounts', access: 'read' },
                { name: 'get_account_balance', access: 'read' },
                { name: 'get_net_worth', access: 'read' },
                { name: 'search_transactions', access: 'read' },
                { name: 'get_transaction', access: 'read' },
                { name: 'spending_by_category', access: 'read' },
                { name: 'cash_flow', access: 'read' },
                { name: 'profit_loss', access: 'read' },
                { name: 'balance_sheet', access: 'read' },
                { name: 'trial_balance', access: 'read' },
                { name: 'budget_status', access: 'read' },
                { name: 'safe_to_spend', access: 'read' },
                { name: 'monthly_summary', access: 'read' },
                { name: 'list_recurring', access: 'read' },
                { name: 'list_drafts', access: 'read' },
                { name: 'quick_add_expense', access: 'write:transactions' },
                { name: 'create_transaction', access: 'write:transactions' },
                { name: 'update_transaction', access: 'write:transactions' },
                { name: 'delete_transaction', access: 'write:transactions' },
                { name: 'create_recurring', access: 'write:transactions' },
            ],
        },
    });
});

export default router;
