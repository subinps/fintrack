import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--fix');

/**
 * F0.17: report (and with --fix, merge) accounts that differ only by letter case
 * within the same user and type. The migration merged these once; this script keeps
 * a check for databases that are older or were restored from a pre-migration dump.
 */
async function main() {
    const duplicates = await prisma.$queryRaw<
        { userId: string; type: string; name: string; ids: number[]; count: bigint }[]
    >`
        SELECT "userId", type, MIN(name) AS name, array_agg(id ORDER BY id) AS ids, COUNT(*) AS count
        FROM "Account"
        GROUP BY "userId", type, lower(name)
        HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
        console.log('No duplicate accounts found.');
        return;
    }

    for (const group of duplicates) {
        const [keep, ...merge] = group.ids;
        console.log(`user=${group.userId} type=${group.type} name="${group.name}" ids=${group.ids.join(',')} -> keep ${keep}`);

        if (!apply) continue;

        await prisma.$transaction(async (tx) => {
            await tx.transactionSplit.updateMany({
                where: { accountId: { in: merge } },
                data: { accountId: keep },
            });
            await tx.account.update({ where: { id: keep }, data: { name: group.name } });
            await tx.account.deleteMany({ where: { id: { in: merge } } });
        });
        console.log(`  merged ${merge.length} account(s) into ${keep}`);
    }

    if (!apply) {
        console.log('\nDry run. Re-run with --fix to merge these accounts.');
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
