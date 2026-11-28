import type { Job } from 'pg-boss';
import { logger } from '../lib/logger';
import { onLedgerEvent } from '../lib/events';
import { enqueue, getQueue, QUEUES, RETRY_LIMIT, startQueue } from '../lib/queue';
import { createNotification } from '../services/notifications';
import { snapshotNetWorth } from '../services/networth';
import { refreshMarketPrices } from './prices';
import { snapshotAllUsers } from './networth';
import { runRecurringSweep, sendRecurringReminders } from '../services/recurring';
import { evaluateAllBudgetAlerts } from '../services/budgets';
import { runAutomationSweep } from '../services/automation';

export interface NetWorthJobData {
    userId?: string;
}

export interface PricesJobData {
    reason?: string;
}

let workerStarted = false;

export function isWorkerRunning(): boolean {
    return workerStarted;
}

type JobData = NetWorthJobData & PricesJobData;

/**
 * Wraps a job body: logs every failure, and once pg-boss has exhausted its retries
 * for a user-scoped job, tells that user instead of failing silently.
 */
const runJob = (queue: string, handler: (data: JobData) => Promise<unknown>) => {
    return async (jobs: Job<JobData>[]) => {
        for (const job of jobs) {
            const data = (job.data ?? {}) as JobData;
            try {
                await handler(data);
            } catch (error) {
                const attempt = job.retryCount + 1;
                logger.error({ err: error, queue, jobId: job.id, attempt }, 'background job failed');

                if (attempt > RETRY_LIMIT && data.userId) {
                    try {
                        await createNotification({
                            userId: data.userId,
                            type: 'JOB_FAILED',
                            title: 'A background job failed',
                            body: `The ${queue} job failed ${attempt} times and was stopped. Your data is safe; try again from Settings.`,
                            href: '/',
                            email: true,
                        });
                    } catch (notifyError) {
                        logger.error({ err: notifyError }, 'could not notify the user about a failed job');
                    }
                }
                throw error;
            }
        }
    };
};

/**
 * Registers workers and cron schedules. Idempotent. Called by src/worker.ts and,
 * unless RUN_WORKER_INLINE=false, by the API process as well.
 */
export async function startWorker(): Promise<void> {
    if (workerStarted) return;

    const boss = await startQueue();

    await boss.work(
        QUEUES.networth,
        { batchSize: 1, pollingIntervalSeconds: 2 },
        runJob(QUEUES.networth, async (data) => {
            if (data.userId) {
                await snapshotNetWorth(data.userId);
            } else {
                await snapshotAllUsers();
            }
        })
    );

    await boss.work(
        QUEUES.prices,
        { batchSize: 1, pollingIntervalSeconds: 2 },
        runJob(QUEUES.prices, async () => {
            await refreshMarketPrices();
        })
    );

    await boss.work(
        QUEUES.recurring,
        { batchSize: 1, pollingIntervalSeconds: 5 },
        runJob(QUEUES.recurring, async () => {
            const sweep = await runRecurringSweep();
            const reminders = await sendRecurringReminders();
            logger.info({ ...sweep, reminders }, 'recurring sweep finished');
        })
    );

    // Every 5 minutes: recurring rules are due-date driven, so a 5 minute sweep is enough.
    await boss.schedule(QUEUES.recurring, '*/5 * * * *', {}, { tz: 'UTC' });
    await boss.work(
        QUEUES.budget,
        { batchSize: 1, pollingIntervalSeconds: 5 },
        runJob(QUEUES.budget, async () => {
            const result = await evaluateAllBudgetAlerts();
            logger.info(result, 'budget alert sweep finished');
        })
    );

    // Daily at 00:15 UTC: catch periods that rolled over while nobody posted a transaction.
    await boss.schedule(QUEUES.budget, '15 0 * * *', {}, { tz: 'UTC' });

    await boss.work(
        QUEUES.automation,
        { batchSize: 1, pollingIntervalSeconds: 5 },
        runJob(QUEUES.automation, async () => {
            const sweep = await runAutomationSweep();
            if (sweep.ran || sweep.failed) logger.info(sweep, 'automation sweep finished');
        })
    );

    // Cron automations are minute-resolution, so the sweep ticks every minute.
    await boss.schedule(QUEUES.automation, '* * * * *', {}, { tz: 'UTC' });

    // Nightly at 23:59 UTC, matching the schedule the old node-cron jobs used.
    await boss.schedule(QUEUES.prices, '59 23 * * *', {}, { tz: 'UTC' });
    await boss.schedule(QUEUES.networth, '59 23 * * *', {}, { tz: 'UTC' });

    // Kick a sweep shortly after boot so a rule that came due while the worker was down posts promptly.
    await boss.send(QUEUES.recurring, {}, { startAfter: 30 });

    onLedgerEvent((event) => {
        if (event.type === 'transaction.completed' || event.type === 'transaction.voided' || event.type === 'transaction.restored' || event.type === 'account.changed') {
            const hour = new Date().toISOString().slice(0, 13);
            void enqueue(QUEUES.networth, { userId: event.userId }, { singletonKey: `networth:${event.userId}:${hour}` });
        }
    });

    workerStarted = true;
    logger.info('worker started and schedules registered');
}

export interface QueueDepth {
    queued: number;
    active: number;
    failed: number;
}

export async function queueDepth(): Promise<Record<string, QueueDepth | null>> {
    const depths: Record<string, QueueDepth | null> = {};
    try {
        const boss = getQueue();
        for (const name of Object.values(QUEUES)) {
            const stats = await boss.getQueueStats(name);
            depths[name] = stats.reduce<QueueDepth>(
                (total, entry) => ({
                    queued: total.queued + entry.queuedCount,
                    active: total.active + entry.activeCount,
                    failed: total.failed + entry.failedCount,
                }),
                { queued: 0, active: 0, failed: 0 }
            );
        }
    } catch {
        for (const name of Object.values(QUEUES)) depths[name] = null;
    }
    return depths;
}
