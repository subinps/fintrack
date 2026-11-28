import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, ArrowUpRight, Compass, Lightbulb, TriangleAlert, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDigest, useInsights } from '../hooks/useFinance';
import { PageGuide } from '@/components/system/PageGuide';
import { PAGE_HELP } from '@/lib/page-help';

const money = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const monthName = (value: string) => {
  const date = new Date(`${value}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export function InsightsTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const insightsQuery = useInsights();
  const digestQuery = useDigest();
  const insights = insightsQuery.data?.insights ?? [];
  const digest = digestQuery.data;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Read the signal</p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A short, honest read of your month — savings rate, spending shifts, runway, and what needs a decision this week.
          </p>
        </div>
      </header>

      <PageGuide {...PAGE_HELP.insights} />

      {insightsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-32 rounded-panel" />
          ))}
        </div>
      ) : insightsQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-10">
            <TriangleAlert className="h-5 w-5 text-warning" />
            <p className="text-sm font-medium">Insights could not be built right now.</p>
            <Button variant="outline" size="sm" onClick={() => insightsQuery.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : insights.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-2 py-12">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Lightbulb className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">Two months of entries unlock insights</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Add this month’s income and a few expenses, and FinTrack starts comparing, spotting drift and estimating runway.
            </p>
            <Button size="sm" onClick={() => onNavigate?.('transactions')}>
              Add an entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {insights.map((insight) => (
            <article
              key={insight.id}
              className={cn(
                'flex flex-col gap-2 rounded-panel border p-4 transition-colors duration-150',
                insight.tone === 'warning'
                  ? 'border-warning/30 bg-warning-soft/20'
                  : insight.tone === 'positive'
                    ? 'border-success/25 bg-success-soft/20'
                    : 'border-border bg-card'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-snug text-foreground">{insight.title}</p>
                {insight.tone === 'warning' ? (
                  <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                ) : insight.tone === 'positive' ? (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <Compass className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">{insight.detail}</p>
              {insight.action && (
                <button
                  type="button"
                  onClick={() => onNavigate?.(insight.action!.tab)}
                  className="mt-auto inline-flex w-fit items-center gap-1 rounded-control text-[11px] font-medium text-primary-strong transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {insight.action.label}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Monthly digest</CardTitle>
              <CardDescription>{digest ? monthName(digest.month) : 'This month'} in five lines.</CardDescription>
            </div>
            {digest?.changePercent !== null && digest?.changePercent !== undefined && (
              <Badge variant="outline" className={cn('gap-1 text-[10px]', digest.changePercent > 0 ? 'text-warning' : 'text-success')}>
                {digest.changePercent > 0 ? <ArrowUpRight className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                spending {digest.changePercent > 0 ? 'up' : 'down'} {Math.abs(digest.changePercent)}%
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {digestQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : digestQuery.isError || !digest ? (
            <p className="text-sm text-muted-foreground">The digest is not available right now.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="grid grid-cols-3 gap-2">
                <DigestStat label="In" value={money(digest.income)} tone="positive" />
                <DigestStat label="Out" value={money(digest.expense)} />
                <DigestStat label="Net" value={money(digest.net)} tone={Number(digest.net) >= 0 ? 'positive' : 'warning'} />
              </div>
              <div>
                <p className="eyebrow mb-2">Top categories</p>
                {digest.topCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No expenses posted this month yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {digest.topCategories.map((category) => {
                      const max = Math.max(...digest.topCategories.map((item) => Number(item.amount)), 1);
                      return (
                        <li key={category.name} className="space-y-1">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="truncate text-foreground">{category.name}</span>
                            <span className="font-mono tabular-nums text-muted-foreground">{money(category.amount)}</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-surface">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, (Number(category.amount) / max) * 100)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DigestStat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'warning' }) {
  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 truncate font-mono text-sm font-semibold tabular-nums', tone === 'positive' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}
