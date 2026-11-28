import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, LineChart, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioAnalytics } from '../hooks/useFinance';

const money = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const signedMoney = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n) || n === 0) return money(0);
  return `${n < 0 ? '−' : '+'}${money(n)}`;
};

const pct = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`);

export function PortfolioPanel() {
  const { data, isLoading, isError, refetch } = usePortfolioAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24 rounded-panel" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-panel" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-2 py-8">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <p className="text-sm font-medium">Portfolio analytics could not be loaded.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.empty) return null;

  const unrealised = Number(data.totals.unrealised);
  const concentration = data.concentration;

  return (
    <section aria-labelledby="portfolio-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Portfolio analytics</p>
          <h2 id="portfolio-heading" className="text-lg font-semibold tracking-tight text-foreground">
            How the holdings are actually doing
          </h2>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
          <LineChart className="mr-1 h-3 w-3" aria-hidden="true" /> XIRR, not guesswork
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Invested" value={money(data.totals.invested)} hint={`${data.holdings.length} holdings`} />
        <Metric label="Market value" value={money(data.totals.marketValue)} hint="at the last known price" />
        <Metric
          label="Unrealised"
          value={signedMoney(data.totals.unrealised)}
          hint={Number(data.totals.invested) > 0 ? `${((unrealised / Number(data.totals.invested)) * 100).toFixed(1)}% on cost` : 'no cost yet'}
          tone={unrealised >= 0 ? 'positive' : 'warning'}
        />
        <Metric
          label="XIRR"
          value={pct(data.totals.xirrPercent)}
          hint="money-weighted return"
          tone={(data.totals.xirrPercent ?? 0) >= 0 ? 'positive' : 'warning'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Allocation</CardTitle>
            <CardDescription>Share of market value held in each position.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface" role="img" aria-label="Allocation by holding">
              {data.allocation.map((slice, index) => (
                <span
                  key={slice.name}
                  title={`${slice.name} ${slice.weightPercent}%`}
                  className="h-full"
                  style={{
                    width: `${Math.max(slice.weightPercent, 1.5)}%`,
                    backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))`,
                  }}
                />
              ))}
            </div>
            <ul className="space-y-1.5">
              {data.allocation.slice(0, 6).map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-foreground">{slice.name}</span>
                  <span className="ml-auto font-mono tabular-nums text-muted-foreground">{slice.weightPercent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className={cn(concentration.length > 0 ? 'border-warning/30' : 'border-border')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Concentration
            </CardTitle>
            <CardDescription>A single position over a quarter of the portfolio is worth a second look.</CardDescription>
          </CardHeader>
          <CardContent>
            {concentration.length === 0 ? (
              <p className="rounded-control border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Nicely spread — no holding is above 25%.
              </p>
            ) : (
              <ul className="space-y-2">
                {concentration.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-2 rounded-control border border-warning/25 bg-warning-soft/20 px-3 py-2 text-[12px]">
                    <span className="truncate text-foreground">{item.name}</span>
                    <span className="shrink-0 font-mono tabular-nums text-warning">{item.weightPercent.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Holdings</CardTitle>
          <CardDescription>Average cost, current value and the return on money actually invested.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-control border border-border">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="bg-surface text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Holding</th>
                  <th className="px-3 py-2 text-right font-medium">Units</th>
                  <th className="px-3 py-2 text-right font-medium">Avg cost</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-right font-medium">Unrealised</th>
                  <th className="px-3 py-2 text-right font-medium">Weight</th>
                  <th className="px-3 py-2 text-right font-medium">XIRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.holdings.map((holding) => (
                  <tr key={holding.accountId}>
                    <td className="px-3 py-2">
                      <p className="truncate font-medium text-foreground">{holding.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {holding.symbol ?? 'unlisted'} · since {holding.firstBuy ?? '—'}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{holding.units}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{money(holding.averageCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{money(holding.marketValue)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono tabular-nums', Number(holding.unrealised) >= 0 ? 'text-success' : 'text-warning')}>
                      {signedMoney(holding.unrealised)}
                      {holding.unrealisedPercent !== null && (
                        <span className="ml-1 text-[10px] text-muted-foreground">{pct(holding.unrealisedPercent)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{holding.weightPercent.toFixed(1)}%</td>
                    <td className={cn('px-3 py-2 text-right font-mono tabular-nums', (holding.xirrPercent ?? 0) >= 0 ? 'text-success' : 'text-warning')}>
                      {pct(holding.xirrPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint: string; tone?: 'neutral' | 'positive' | 'warning' }) {
  return (
    <div className="rounded-panel border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1 truncate font-mono text-xl font-semibold tabular-nums', tone === 'positive' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-foreground')}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
