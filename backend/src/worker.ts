import 'dotenv/config';
import { logger } from './lib/logger';
import { startWorker } from './jobs';
import { stopQueue } from './lib/queue';

/**
 * Standalone worker process: run with `npm run dev:worker` (or `node dist/worker.js`).
 * Set RUN_WORKER_INLINE=false on the API so the two processes do not both poll.
 */
startWorker()
    .then(() => {
        logger.info('worker process ready');
    })
    .catch((error) => {
        logger.error({ err: error }, 'worker process failed to start');
        process.exit(1);
    });

const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker shutting down');
    await stopQueue();
    process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
