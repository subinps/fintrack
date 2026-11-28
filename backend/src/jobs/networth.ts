import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { snapshotNetWorth } from '../services/networth';

export interface NetWorthSnapshotResult {
    users: number;
    failed: number;
}

export async function snapshotAllUsers(): Promise<NetWorthSnapshotResult> {
    const users = await prisma.user.findMany({ select: { id: true } });
    const result: NetWorthSnapshotResult = { users: users.length, failed: 0 };

    for (const user of users) {
        try {
            await snapshotNetWorth(user.id);
        } catch (error) {
            result.failed += 1;
            logger.error({ err: error, userId: user.id }, 'net worth snapshot failed for user');
        }
    }

    logger.info(result, 'net worth snapshots written');
    return result;
}
