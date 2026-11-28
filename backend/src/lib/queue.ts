import { PgBoss, type SendOptions } from 'pg-boss';
import { logger } from './logger';

export const QUEUES = {
    networth: 'networth-snapshot',
    prices: 'prices-refresh',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const RETRY_LIMIT = 3;

let boss: PgBoss | null = null;

export async function startQueue(): Promise<PgBoss> {
    if (boss) return boss;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required to start the job queue');
    }

    const instance = new PgBoss({
        connectionString,
        schema: 'pgboss',
        superviseIntervalSeconds: 30,
    });

    instance.on('error', (error) => {
        logger.error({ err: error }, 'pg-boss error');
    });

    await instance.start();

    for (const name of Object.values(QUEUES)) {
        await instance.createQueue(name, {
            retryLimit: RETRY_LIMIT,
            retryDelay: 30,
            retryBackoff: true,
            expireInSeconds: 15 * 60,
        });
    }

    boss = instance;
    logger.info('job queue started');
    return instance;
}

export function isQueueStarted(): boolean {
    return boss !== null;
}

export function getQueue(): PgBoss {
    if (!boss) {
        throw new Error('Job queue has not been started');
    }
    return boss;
}

export async function enqueue(name: QueueName, data: object = {}, options?: SendOptions): Promise<string | null> {
    if (!boss) {
        logger.warn({ queue: name }, 'job dropped: queue not started');
        return null;
    }
    try {
        return await boss.send(name, data, options);
    } catch (error) {
        logger.error({ err: error, queue: name }, 'failed to enqueue job');
        return null;
    }
}

export async function stopQueue(): Promise<void> {
    if (!boss) return;
    const instance = boss;
    boss = null;
    await instance.stop({ graceful: true });
    logger.info('job queue stopped');
}
