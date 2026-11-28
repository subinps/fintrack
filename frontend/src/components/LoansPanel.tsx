import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarClock, CreditCard, Landmark, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCards, useLoans, useUpdateLoanTerms } from '../hooks/useFinance';

const money = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function LoansPanel() {
  const { data: loans, isLoading, isError, refetch } = useLoans();
  const { data: cards } = useCards();
  const update = useUpdateLoanTerms();
  const [editing, setEditing] = useState<{ accountId: number; name: string; rate: string; tenure: string; emi: string; limit: string; dueDay: string } | null>(null);

  const saveTerms = async () => {
    if (!editing) return;
    try {
      await update.mutateAsync({
        accountId: editing.accountId,
        body: {
          interestRate: editing.rate === '' ? null : Number(editing.rate),
          tenureMonths: editing.tenure === '' ? null : Number(editing.tenure),
          emiPaise: editing.emi === '' ? null : editing.emi,
          creditLimitPaise: editing.limit === '' ? null : editing.limit,
          dueDay: editing.dueDay === '' ? null : Number(editing.dueDay),
        },
      });
      toast.success(`${editing.name} updated.`);
      setEditing(null);
    } catch {
      toast.error('Could not save those details.');
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-panel" />
        <Skeleton className="h-40 rounded-panel" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-2 py-8">
          <p className="text-sm font-medium">Loan details could not be loaded.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const hasCards = (cards?.length ?? 0) > 0;
  const hasLoans = (loans?.length ?? 0) > 0;
  if (!hasCards && !hasLoans) return null;

  return (
    <section aria-labelledby="loans-heading" className="space-y-3">
      <div>
        <p className="eyebrow">Loan desk</p>
        <h2 id="loans-heading" className="text-lg font-semibold tracking-tight text-foreground">
          Payoff progress and card health
        </h2>
      </div>

      {hasCards && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards?.map((card) => (
            <article key={card.accountId} className="rounded-panel border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                    <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {card.name}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {card.nextDue ? `due ${day(card.nextDue)}` : 'no due day set'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 text-[10px]',
                    card.health === 'high' ? 'border-warning/40 text-warning' : card.health === 'medium' ? 'border-primary/30 text-primary-strong' : 'text-muted-foreground'
                  )}
                >
                  {card.utilisationPercent === null ? 'no limit' : `${card.utilisationPercent}% used`}
                </Badge>
              </div>
              <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-foreground">{money(card.outstanding)}</p>
              <p className="text-[11px] text-muted-foreground">
                {card.creditLimit ? `of ${money(card.creditLimit)} · ${money(card.available)} available` : 'Set a credit limit in the loan details'}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className={cn('h-full rounded-full', card.health === 'high' ? 'bg-warning' : card.health === 'medium' ? 'bg-primary' : 'bg-success')}
                  style={{ width: `${Math.min(100, card.utilisationPercent ?? 0)}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Minimum due {money(card.minimumDue)}</span>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      accountId: card.accountId,
                      name: card.name,
                      rate: '',
                      tenure: '',
                      emi: '',
                      limit: '',
                      dueDay: String(card.dueDay ?? ''),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-control font-medium text-primary-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Edit ${card.name} card details`}
                >
                  <Settings2 className="h-3 w-3" aria-hidden="true" /> terms
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {hasLoans && (
        <div className="grid gap-3 lg:grid-cols-2">
          {loans?.map((loan) => (
            <Card key={loan.accountId}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-1.5 truncate text-base">
                      <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {loan.name}
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      {money(loan.outstanding)} outstanding
                      {loan.interestRate !== null ? ` · ${loan.interestRate}%` : ''}
                      {loan.tenureMonths ? ` · ${loan.tenureMonths} months` : ''}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${loan.name} terms`}
                    onClick={() =>
                      setEditing({
                        accountId: loan.accountId,
                        name: loan.name,
                        rate: loan.interestRate === null ? '' : String(loan.interestRate),
                        tenure: loan.tenureMonths === null ? '' : String(loan.tenureMonths),
                        emi: loan.emi === '0' ? '' : loan.emi,
                        limit: '',
                        dueDay: loan.nextDue ? String(new Date(`${loan.nextDue}T00:00:00Z`).getUTCDate()) : '',
                      })
                    }
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{loan.monthsPaid ?? 0} paid</span>
                  <span>{loan.monthsRemaining ?? '—'} left</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, loan.progressPercent)}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono tabular-nums text-foreground">EMI {money(loan.emi)}</span>
                  {loan.nextDue && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      next {day(loan.nextDue)} ({loan.daysToDue}d)
                    </span>
                  )}
                </div>
                {loan.schedule.length > 0 && (
                  <details className="group rounded-control border border-border bg-surface/50 px-3 py-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Amortisation preview
                      {loan.interestRemaining ? ` · ${money(loan.interestRemaining)} interest to go` : ''}
                    </summary>
                    <table className="mt-2 w-full text-left text-[11px]">
                      <thead className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-2 font-medium">Date</th>
                          <th className="py-1 pr-2 text-right font-medium">Interest</th>
                          <th className="py-1 pr-2 text-right font-medium">Principal</th>
                          <th className="py-1 text-right font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono tabular-nums text-muted-foreground">
                        {loan.schedule.slice(0, 6).map((row) => (
                          <tr key={row.month} className="border-t border-border/60">
                            <td className="py-1 pr-2">{row.dueDate.slice(0, 7)}</td>
                            <td className="py-1 pr-2 text-right">{money(row.interest)}</td>
                            <td className="py-1 pr-2 text-right">{money(row.principal)}</td>
                            <td className="py-1 text-right">{money(row.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loan and card details</DialogTitle>
            <DialogDescription>
              {editing?.name} — these numbers drive the schedule, utilisation and reminders.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="loan-rate" className="mb-1 block text-[11px] text-muted-foreground">Interest rate %</Label>
                <Input id="loan-rate" inputMode="decimal" value={editing.rate} onChange={(event) => setEditing({ ...editing, rate: event.target.value })} placeholder="12.5" />
              </div>
              <div>
                <Label htmlFor="loan-tenure" className="mb-1 block text-[11px] text-muted-foreground">Tenure (months)</Label>
                <Input id="loan-tenure" inputMode="numeric" value={editing.tenure} onChange={(event) => setEditing({ ...editing, tenure: event.target.value })} placeholder="60" />
              </div>
              <div>
                <Label htmlFor="loan-emi" className="mb-1 block text-[11px] text-muted-foreground">EMI (₹)</Label>
                <Input id="loan-emi" inputMode="decimal" value={editing.emi} onChange={(event) => setEditing({ ...editing, emi: event.target.value })} placeholder="12600" />
              </div>
              <div>
                <Label htmlFor="loan-limit" className="mb-1 block text-[11px] text-muted-foreground">Credit limit (₹)</Label>
                <Input id="loan-limit" inputMode="decimal" value={editing.limit} onChange={(event) => setEditing({ ...editing, limit: event.target.value })} placeholder="200000" />
              </div>
              <div>
                <Label htmlFor="loan-due" className="mb-1 block text-[11px] text-muted-foreground">Due day of month</Label>
                <Input id="loan-due" inputMode="numeric" value={editing.dueDay} onChange={(event) => setEditing({ ...editing, dueDay: event.target.value })} placeholder="5" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveTerms} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
