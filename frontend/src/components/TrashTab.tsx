import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetTrash, useRestoreTransaction } from '../hooks/useQueries';
import { format } from 'date-fns';
import { toast } from 'sonner';

const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);

export function TrashTab() {
  const { data, isLoading, isError, refetch } = useGetTrash();
  const restoreTransaction = useRestoreTransaction();

  const handleRestore = async (id: number) => {
    try {
      await restoreTransaction.mutateAsync(id);
      toast.success('Transaction restored');
    } catch {
      toast.error('Could not restore the transaction');
    }
  };

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Ledger</p>
        <h1 className="text-[clamp(1.5rem,2.4vw,2rem)] font-semibold tracking-[-0.03em] text-foreground">Trash</h1>
        <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
          Deleted entries are voided, not erased: they stop counting towards balances and charts, and can be restored here.
        </p>
      </header>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-3 p-5" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <div className="p-5 text-[13px] text-muted-foreground">
              Could not load deleted entries.{' '}
              <button type="button" onClick={() => refetch()} className="font-medium text-primary-strong hover:underline">
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <div className="px-5 py-14 text-center">
              <RotateCcw className="mx-auto h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
              <p className="mt-3 text-[13px] font-medium text-foreground">Trash is empty</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Entries you delete will wait here if you change your mind.</p>
            </div>
          )}

          {rows.length > 0 && (
            <ul className="divide-y divide-border">
              {rows.map((transaction) => {
                const total = transaction.splits
                  .filter((split) => Number(split.amount) > 0)
                  .reduce((sum, split) => sum + Number(split.amount), 0);

                return (
                  <li key={transaction.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{transaction.description}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {format(new Date(transaction.date), 'dd MMM yyyy')} · {rupees(total)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(transaction.id)}
                      disabled={restoreTransaction.isPending}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
