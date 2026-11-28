import { prisma } from '../lib/prisma';

export type AccountSummary = {
    id: number;
    name: string;
    type: string;
    subType: string | null;
};

export type ResolveResult =
    | { kind: 'found'; account: AccountSummary }
    | { kind: 'ambiguous'; candidates: AccountSummary[] }
    | { kind: 'missing'; query: string; candidates: AccountSummary[] };

const summarise = (account: { id: number; name: string; type: string; subType: string | null }): AccountSummary => ({
    id: account.id,
    name: account.name,
    type: account.type,
    subType: account.subType,
});

export class AmbiguousAccountError extends Error {
    statusCode = 409;
    code = 'ACCOUNT_AMBIGUOUS';
    candidates: AccountSummary[];

    constructor(query: string, candidates: AccountSummary[]) {
        super(
            `"${query}" matches more than one account: ${candidates
                .map((candidate) => `${candidate.name} (${candidate.type})`)
                .join(', ')}. Use a more specific name.`
        );
        this.name = 'AmbiguousAccountError';
        this.candidates = candidates;
    }
}

/**
 * Resolves an account by human name: exact (case-insensitive), then prefix, then substring.
 * Never guesses between several equally good matches - callers get the candidates instead.
 */
export async function resolveAccount(
    userId: string,
    query: string,
    options: { type?: string | string[]; subType?: string } = {}
): Promise<ResolveResult> {
    const trimmed = query.trim();
    if (!trimmed) return { kind: 'missing', query, candidates: [] };

    const types = options.type ? (Array.isArray(options.type) ? options.type : [options.type]) : undefined;
    const accounts = await prisma.account.findMany({
        where: {
            userId,
            ...(types ? { type: { in: types } } : {}),
            ...(options.subType ? { subType: options.subType } : {}),
        },
        select: { id: true, name: true, type: true, subType: true },
        orderBy: { name: 'asc' },
    });

    const lower = trimmed.toLowerCase();
    const tiers = [
        accounts.filter((account) => account.name.toLowerCase() === lower),
        accounts.filter((account) => account.name.toLowerCase().startsWith(lower)),
        accounts.filter((account) => account.name.toLowerCase().includes(lower)),
    ];

    for (const tier of tiers) {
        if (tier.length === 1) return { kind: 'found', account: summarise(tier[0]) };
        if (tier.length > 1) return { kind: 'ambiguous', candidates: tier.map(summarise) };
    }

    // Fuzzy fallback: token overlap ("hdfc savings" -> "HDFC Bank Savings").
    const tokens = lower.split(/\s+/).filter(Boolean);
    const fuzzy = accounts.filter((account) => {
        const name = account.name.toLowerCase();
        return tokens.every((token) => name.includes(token));
    });
    if (fuzzy.length === 1) return { kind: 'found', account: summarise(fuzzy[0]) };
    if (fuzzy.length > 1) return { kind: 'ambiguous', candidates: fuzzy.map(summarise) };

    const near = accounts
        .map((account) => ({ account, score: similarity(lower, account.name.toLowerCase()) }))
        .filter((entry) => entry.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((entry) => summarise(entry.account));
    if (near.length === 1) return { kind: 'found', account: near[0] };
    return { kind: 'missing', query: trimmed, candidates: near };
}

/** Requires an unambiguous match; throws so automation runs and MCP calls fail loudly. */
export async function resolveAccountOrThrow(
    userId: string,
    query: string,
    options: { type?: string | string[]; subType?: string } = {}
): Promise<AccountSummary> {
    const result = await resolveAccount(userId, query, options);
    if (result.kind === 'found') return result.account;
    if (result.kind === 'ambiguous') throw new AmbiguousAccountError(query, result.candidates);
    const suggestions = result.candidates.length
        ? ` Did you mean ${result.candidates.map((candidate) => candidate.name).join(' or ')}?`
        : '';
    const error = new Error(`No account matches "${query}".${suggestions}`);
    (error as Error & { statusCode?: number; code?: string }).statusCode = 404;
    (error as Error & { statusCode?: number; code?: string }).code = 'ACCOUNT_NOT_FOUND';
    throw error;
}

/** Dice coefficient over bigrams; cheap and good enough for "did you mean". */
function similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const bigrams = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i += 1) {
        const gram = a.slice(i, i + 2);
        bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
    }
    let hits = 0;
    for (let i = 0; i < b.length - 1; i += 1) {
        const gram = b.slice(i, i + 2);
        const count = bigrams.get(gram) ?? 0;
        if (count > 0) {
            bigrams.set(gram, count - 1);
            hits += 1;
        }
    }
    return (2 * hits) / (a.length - 1 + (b.length - 1));
}
