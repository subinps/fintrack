import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { snapshotNetWorthAsOf } from '../src/services/networth';

/**
 * F0.13: rebuild net-worth snapshots for every user from the first ledger entry to
 * today. Historical days use the ledger balance up to that day (cost basis for
 * investments, because historical market prices are not stored). Use --from=YYYY-MM-DD
 * to rebuild a specific window.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const argFrom = process.argv.find((arg) => arg.startsWith('--from='))?.split('=')[1];

async function main() {
    const users = await prisma.user.findMany({ select: { id: true, timezone: true } });

    for (const user of users) {
        const first = await prisma.transaction.findFirst({
            where: { userId: user.id, status: 'COMPLETED', deletedAt: null },
            orderBy: { date: 'asc' },
            select: { date: true },
        });
        if (!first) continue;

        const start = argFrom ? new Date(`${argFrom}T00:00:00.000Z`) : new Date(first.date);
        let written = 0;

        for (let cursor = start.getTime(); cursor <= Date.now(); cursor += DAY_MS) {
            const at = new Date(cursor);
            await snapshotNetWorthAsOf(user.id, at, user.timezone);
            written += 1;
        }

        console.log(`user=${user.id} snapshots=${written}`);
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
