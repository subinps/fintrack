import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { isQueueStarted } from '../lib/queue';
import { isWorkerRunning, queueDepth } from '../jobs';

const router = Router();

/**
 * Liveness + readiness in one: the database must answer, the job queue must be up,
 * and the worker must be registered. Anything short of that is 503 so uptime checks
 * and the reverse proxy can act on it.
 */
router.get('/', async (_req, res) => {
    const startedAt = Date.now();

    let db: 'up' | 'down' = 'down';
    try {
        await prisma.$queryRaw`SELECT 1`;
        db = 'up';
    } catch {
        db = 'down';
    }

    const queueStarted = isQueueStarted();
    const workers = isWorkerRunning();
    const queues = queueStarted ? await queueDepth() : {};

    const healthy = db === 'up' && queueStarted && workers;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        db,
        queue: { started: queueStarted, workers, queues },
        latencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

export default router;
