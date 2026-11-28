import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Integration harness: a real Express process against a real PostgreSQL test database.
 * Nothing here mocks the API, the ORM or the ledger.
 */
const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/fintrack_test?schema=public';

/**
 * Every test file starts its own server on top of the dev API, so keep each
 * pool small: with the default pool the suite runs Postgres out of connections
 * and suites fail with "too many clients" instead of real errors.
 */
const POOLED_DATABASE_URL = `${TEST_DATABASE_URL}${TEST_DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=2&pool_timeout=20`;

export const PORT = Number(process.env.TEST_PORT ?? 4100 + Math.floor(Math.random() * 800));
export const BASE_URL = `http://127.0.0.1:${PORT}`;

process.env.DATABASE_URL = POOLED_DATABASE_URL;

export const prisma = new PrismaClient({ datasources: { db: { url: POOLED_DATABASE_URL } } });

let server: ChildProcess | null = null;

/** Fresh random signing key per test run; never a real secret and never committed. */
const ephemeralJwtSecret = randomBytes(32).toString('hex');

export const env = {
    ...process.env,
    DATABASE_URL: POOLED_DATABASE_URL,
    PORT: String(PORT),
    NODE_ENV: 'test',
    RUN_WORKER_INLINE: 'false',
    JWT_SECRET: process.env.TEST_JWT_SECRET ?? ephemeralJwtSecret,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '2525',
    SMTP_USER: 'test@localhost',
    SMTP_PASS: 'test',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startServer(): Promise<void> {
    if (server) return;

    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
        cwd: path.resolve(__dirname, '..'),
        env,
        stdio: 'pipe',
    });

    server = spawn('npx', ['tsx', 'src/index.ts'], {
        cwd: path.resolve(__dirname, '..'),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logs: string[] = [];
    server.stdout?.on('data', (chunk) => logs.push(String(chunk)));
    server.stderr?.on('data', (chunk) => logs.push(String(chunk)));
    server.on('exit', (code, signal) => {
        if (server && (code !== null && code !== 0 || signal)) {
            console.error(`[test-server exited] code=${code} signal=${signal}\n${logs.slice(-40).join('')}`);
        }
    });

    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${BASE_URL}/health`);
            if (response.ok || response.status === 503) return;
        } catch {
            // not up yet
        }
        await wait(250);
    }
    throw new Error(`Test server did not start. Last logs: ${logs.slice(-30).join('')}`);
}

export async function stopServer(): Promise<void> {
    if (server) {
        const child = server;
        server = null;
        child.removeAllListeners('exit');
        child.stdout?.removeAllListeners('data');
        child.stderr?.removeAllListeners('data');
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.kill('SIGTERM');
        await wait(500);
        if (child.exitCode === null) child.kill('SIGKILL');
        child.unref();
    }
    await prisma.$disconnect();
}

export type ApiResult<T = any> = { status: number; body: T };

let counter = 0;

export async function api<T = any>(
    route: string,
    options: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}
): Promise<ApiResult<T>> {
    const response = await fetch(`${BASE_URL}${route}`, {
        method: options.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
            ...(options.headers ?? {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    let body: unknown = null;
    const text = await response.text();
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text;
    }
    return { status: response.status, body: body as T };
}

export interface TestUser {
    id: string;
    email: string;
    token: string;
    accounts: { bank: number; cash: number; salary: number; food: number; rent: number };
}

/** Registers, verifies and signs in a user, then creates the chart of accounts the tests need. */
export async function createUser(label = 'main'): Promise<TestUser> {
    counter += 1;
    const email = `${label}-${counter}-${Date.now()}@example.com`;
    const password = 'Sup3rSecret!';

    const registration = await api('/api/auth/register', { method: 'POST', body: { name: label, email, password } });
    if (registration.status !== 201) throw new Error(`register failed: ${JSON.stringify(registration.body)}`);

    await prisma.user.update({ where: { email }, data: { isVerified: true } });
    const login = await api<{ accessToken: string; user: { id: string } }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
    });
    if (login.status !== 200) throw new Error(`login failed: ${JSON.stringify(login.body)}`);

    return {
        id: login.body.user.id,
        email,
        token: login.body.accessToken,
        accounts: { bank: 0, cash: 0, salary: 0, food: 0, rent: 0 },
    };
}

export async function createAccount(user: TestUser, name: string, type: string, subType?: string): Promise<number> {
    const created = await prisma.account.create({
        data: { userId: user.id, name, type, subType: subType ?? null },
        select: { id: true },
    });
    return created.id;
}

export async function chartOfAccounts(user: TestUser): Promise<void> {
    user.accounts.bank = await createAccount(user, 'HDFC Bank', 'ASSET', 'Bank');
    user.accounts.cash = await createAccount(user, 'Cash', 'ASSET', 'Cash');
    user.accounts.salary = await createAccount(user, 'Salary', 'INCOME', 'Salary');
    user.accounts.food = await createAccount(user, 'Food', 'EXPENSE', 'Food');
    user.accounts.rent = await createAccount(user, 'Rent', 'EXPENSE', 'Rent');
}

/** Posts a transaction straight through the API (the same path the UI uses). */
export async function postTransactionViaApi(
    user: TestUser,
    input: { description: string; date: string; lines: { accountId: number; amount: string }[]; status?: string; tags?: string[] }
): Promise<ApiResult<{ id: number }>> {
    return api<{ id: number }>('/api/transactions', {
        method: 'POST',
        token: user.token,
        body: {
            description: input.description,
            date: input.date,
            status: input.status ?? 'COMPLETED',
            tags: input.tags,
            splits: input.lines,
        },
    });
}

export async function accountBalance(user: TestUser, accountId: number): Promise<bigint> {
    const aggregate = await prisma.transactionSplit.aggregate({
        where: { accountId, transaction: { userId: user.id, status: 'COMPLETED' } },
        _sum: { amount: true },
    });
    return aggregate._sum.amount ?? 0n;
}
