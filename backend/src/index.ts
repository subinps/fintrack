import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';

dotenv.config();

import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import transactionRoutes from './routes/transactions';
import priceRoutes from './routes/price';
import analyticsRoutes from './routes/analytics';
import categoryRoutes from './routes/categories';
import userDataRoutes from './routes/user_data';
import healthRoutes from './routes/health';
import notificationRoutes from './routes/notifications';
import networthRoutes from './routes/networth';
import recurringRoutes from './routes/recurring';
import budgetRoutes from './routes/budgets';
import goalRoutes from './routes/goals';
import mcpRoutes from './routes/mcp';
import automationRoutes from './routes/automations';
import reconciliationRoutes from './routes/reconciliation';
import importRoutes from './routes/imports';
import attachmentRoutes from './routes/attachments';
import reportRoutes from './routes/reports';
import taxRoutes from './routes/tax';
import investmentRoutes from './routes/investments';
import loanRoutes from './routes/loans';
import splitRoutes from './routes/splits';
import insightRoutes from './routes/insights';
import { buildMcpServer } from './mcp/server';
import { authenticatePersonalToken } from './services/tokens';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from './lib/logger';
import { LedgerError } from './services/ledger';
import { startWorker } from './jobs';
import { registerBudgetAlertHandlers } from './jobs/budget-alerts';
import { registerAutomationEventHandlers } from './services/automation';
import { stopQueue } from './lib/queue';

const execAsync = promisify(exec);

// Budget thresholds must fire in the API process too (tests and single-process deploys skip the worker).
registerBudgetAlertHandlers();

// Ledger-event automations run wherever ledger events are emitted, not only in the worker.
registerAutomationEventHandlers();

// Strict Env Validation
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
    logger.error(`CRITICAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet());
app.set('trust proxy', 1); // Trust first proxy (CapRover/Nginx)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Restrict to frontend domain if set
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/api/health' },
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// MCP endpoint: AI clients authenticate with a personal token (Settings > Connect to AI).
// Stateless streamable HTTP: one transport and server per request.
app.post('/mcp', async (req, res) => {
    const header = req.headers.authorization ?? '';
    const bearer = Array.isArray(header) ? header[0] : header;
    const raw = bearer.startsWith('Bearer ') ? bearer.slice(7) : String(req.headers['x-api-key'] ?? '');
    const token = raw ? await authenticatePersonalToken(raw).catch(() => null) : null;

    if (!token) {
        res.status(401).json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Missing or invalid FinTrack token. Create one in Settings > Connect to AI.' },
            id: null,
        });
        return;
    }

    const server = buildMcpServer(token, req.ip);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
        transport.close().catch(() => undefined);
        server.close().catch(() => undefined);
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        logger.error({ err: error }, 'MCP request failed');
        if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
});

app.get('/mcp', (_req, res) => {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Use POST for MCP requests' }, id: null });
});

// Serve static files from the React frontend app
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../public')));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/price', priceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/user', userDataRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/networth', networthRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/import', importRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/splits', splitRoutes);
app.use('/api', insightRoutes);

// Health is served both at /health (spec, for uptime probes) and /api/health (existing clients).
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// Anything that doesn't match the above, send back index.html
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof LedgerError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    logger.error({ err }, 'unhandled request error');
    res.status(500).json({ error: 'Something went wrong!' });
});

async function deployMigrations() {
    logger.info('Applying database migrations...');
    try {
        const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
        if (stdout) logger.info({ output: stdout.trim() }, 'prisma migrate deploy');
        if (stderr) logger.warn({ output: stderr.trim() }, 'prisma migrate deploy warning');
    } catch (error) {
        logger.error({ err: error }, 'failed to apply database migrations');
        logger.error('IMPORTANT: Run "npx prisma migrate deploy" manually and check the database connection.');
        // We do not exit the process, allowing the app to start even if migrations fail (e.g. if DB is unreachable temporarily)
    }
}

async function main() {
    await deployMigrations();

    if (process.env.RUN_WORKER_INLINE !== 'false') {
        try {
            await startWorker();
        } catch (error) {
            logger.error({ err: error }, 'worker failed to start; API will run without background jobs');
        }
    }

    const server = app.listen(PORT, () => {
        logger.info({ port: PORT }, 'server listening');
    });

    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'shutting down');
        server.close();
        await stopQueue();
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
    logger.error({ err: error }, 'fatal startup error');
    process.exit(1);
});
