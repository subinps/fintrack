import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma';

export const TOKEN_PREFIX = 'ft_pat_';

export type WriteMode = 'DRAFT' | 'DIRECT';

export interface IssuedToken {
    token: string;
    prefix: string;
    tokenHash: string;
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function issueToken(): IssuedToken {
    const secret = randomBytes(24).toString('base64url');
    const token = `${TOKEN_PREFIX}${secret}`;
    return { token, prefix: token.slice(0, TOKEN_PREFIX.length + 6), tokenHash: hashToken(token) };
}

export interface AuthenticatedToken {
    id: string;
    userId: string;
    name: string;
    scopes: string[];
    writeMode: WriteMode;
    accountAllowList: number[];
}

/** Looks up a bearer token. Returns null for unknown, revoked or expired tokens. */
export async function authenticatePersonalToken(raw: string): Promise<AuthenticatedToken | null> {
    if (!raw.startsWith(TOKEN_PREFIX)) return null;
    const record = await prisma.personalAccessToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!record || record.revokedAt) return null;
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;

    prisma.personalAccessToken
        .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);

    return {
        id: record.id,
        userId: record.userId,
        name: record.name,
        scopes: record.scopes,
        writeMode: record.writeMode as WriteMode,
        accountAllowList: record.accountAllowList,
    };
}

export function hasScope(token: AuthenticatedToken, scope: string): boolean {
    return token.scopes.includes(scope) || token.scopes.includes('admin');
}

export function canWriteAccount(token: AuthenticatedToken, accountId: number): boolean {
    return token.accountAllowList.length === 0 || token.accountAllowList.includes(accountId);
}
