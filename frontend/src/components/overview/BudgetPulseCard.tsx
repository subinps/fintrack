import { ArrowRight, Target } from 'lucide-react';
import { useBudgets, useSafeToSpend } from '../../hooks/useBudgets';
import { formatINR } from '../../lib/finance';
import { cn } from '@/lib/utils';
import { SkeletonBlock } from './primitives';

const rupees = (paise: string | undefined) => formatINR(Number(paise ?? 0));

export function BudgetPulseCard({ onOpen }: { onOpen: () => void }) {
  const budgetsQuery = useBudgets();
  const safeQuery = useSafeToSpend(30);
  const budgets = budgetsQuery.data ?? [];

  if (budgetsQuery.isLoading) {
    return <SkeletonBlock className="h-[132px] w-full" />;
  }

  if (budgets.length === 0) {
    return (
      <section className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Budgets">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel border border-primary/25 bg-primary-soft">
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-foreground">No budget running this month</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Set limits per category and the overview shows spend against them all month.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex shrink-0 items-center gap-1 rounded-sm text-[12px] font-medium text-primary-strong transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Set a budget
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </section>
    );
  }

  const totalLimit = budgets.reduce((sum, budget) => sum + Number(budget.totalLimitPaise), 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + Number(budget.totalSpentPaise), 0);
  const percent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  return (
    <section className="panel p-5" aria-label="Budget summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Budgets · this month</p>
          <p className="mono mt-1.5 text-[22px] font-medium tabular-nums tracking-[-0.02em] text-foreground">
            {rupees(String(totalSpent))}
            <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">of {rupees(String(totalLimit))}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Safe to spend · 30 days</p>
          <p
            className={cn(
              'mono mt-1.5 text-[18px] tabular-nums',
              Number(safeQuery.data?.safeToSpendPaise ?? 0) < 0 ? 'text-destructive' : 'text-success'
            )}
          >
            {rupees(safeQuery.data?.safeToSpendPaise)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', percent > 100 ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.min(100, Math.max(percent, 2))}%` }}
        />
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {budgets.slice(0, 4).map((budget) => (
          <div key={budget.id} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12px] text-foreground">{budget.name}</span>
              <span className="mono shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                {Math.round(budget.percentUsed)}%
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full',
                  budget.pace === 'OVER' ? 'bg-destructive' : budget.pace === 'WATCH' ? 'bg-warning' : 'bg-primary/70'
                )}
                style={{ width: `${Math.min(100, Math.max(budget.percentUsed, 2))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 flex items-center gap-1 rounded-sm text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Open budgets & goals
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </section>
  );
}
