# Operations

## Database migrations

The schema is versioned under `backend/prisma/migrations`. The API applies pending
migrations on boot with `prisma migrate deploy`; nothing uses `prisma db push` any
more because it cannot create the deferred trigger that enforces balanced splits.

```bash
cd backend
npm run db:migrate        # apply pending migrations (what boot does)
npm run db:dev -- --name some_change   # create a new migration locally
```

The `20260102000000_phase0_foundation` migration is the one that matters for
integrity: it merges duplicate accounts, adds a case-insensitive unique index on
account names, and installs the `transaction_splits_balanced` constraint trigger
(`DEFERRABLE INITIALLY DEFERRED`, so a transaction may be built split by split and
is checked when it commits).

## Background jobs

Jobs run on pg-boss, which stores state in the `pgboss` schema of the same database.

- The API process starts the queue and, unless `RUN_WORKER_INLINE=false`, also the
  worker, so a single container is enough.
- To split them (recommended in production), set `RUN_WORKER_INLINE=false` on the
  API and run `node dist/worker.js` as a second process.
- Queues: `prices-refresh` and `networth-snapshot`, both scheduled nightly at 23:59
  UTC with 3 retries. A user-scoped job that exhausts its retries creates a
  `JOB_FAILED` notification (and an email when SMTP is configured).
- `GET /health` (also `/api/health`) returns 200 only when the database answers, the
  queue has started and the worker is registered; otherwise 503 with details.

## Backups

Take a nightly logical dump and keep 14 days. This is the documented recovery path
for both application data and the `pgboss` schema.

```bash
# /etc/cron.d/fintrack-backup  (runs at 01:30 UTC, after the nightly jobs)
30 1 * * * postgres PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
  --format=custom --no-owner --dbname=fintrack \
  --file=/var/backups/fintrack/fintrack-$(date +\%F).dump

# keep two weeks
35 1 * * * postgres find /var/backups/fintrack -name '*.dump' -mtime +14 -delete
```

Restore:

```bash
createdb fintrack_restore
pg_restore --no-owner --dbname=fintrack_restore /var/backups/fintrack/fintrack-2026-11-27.dump
```

Test a restore into a scratch database once a quarter; a backup that has never been
restored is not a backup.

## Maintenance scripts

```bash
cd backend
npm run db:dedupe              # report accounts that differ only by case
npm run db:dedupe -- --fix     # merge them
npm run db:backfill-networth   # rebuild net-worth snapshots per day (or --from=YYYY-MM-DD)
```
