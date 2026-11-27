import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { cn } from '@/lib/utils';
import {
  changePct,
  formatINR,
  formatPct,
  type CashflowPoint,
  type CategorySlice,
  type NetWorthSnapshot,
} from '@/lib/finance';
import { CHART_COLORS, DeltaChip, SectionHeading } from './primitives';

const axisStyle = {
  fontSize: 10,
  fontFamily: 'JetBrains Mono Variable, monospace',
  fill: 'hsl(var(--muted-foreground))',
};

export function CashflowChartCard({
  series,
  onOpenIncomeExpense,
}: {
  series: CashflowPoint[];
  onOpenIncomeExpense: () => void;
}) {
  const [view, setView] = useState<'both' | 'net'>('both');
  const best = useMemo(() => {
    if (!series.length) return null;
    return series.reduce((max, point) => (point.net > max.net ? point : max), series[0]);
  }, [series]);
  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  const totalIn = series.reduce((sum, point) => sum + point.income, 0);
  const totalOut = series.reduce((sum, point) => sum + point.expense, 0);

  return (
    <section className="panel flex flex-col p-5" aria-labelledby="cashflow-heading">
      <SectionHeading
        eyebrow="Cash flow"
        title="Money in against money out"
        description="Income and spend per calendar month, with the net line that decides the month."
        action={
          <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-0.5" role="group" aria-label="Cash flow view">
            {(['both', 'net'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  view === option
                    ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(150_20%_10%/0.08)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option === 'both' ? 'Flows' : 'Net only'}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <LegendDot color="hsl(var(--chart-2))" label="Income" value={formatINR(totalIn, { compact: true })} />
        <LegendDot color="hsl(var(--chart-3))" label="Spend" value={formatINR(totalOut, { compact: true })} />
        <LegendDot color="hsl(var(--chart-1))" label="Net" value={formatINR(totalIn - totalOut, { compact: true, signed: true })} />
        {best ? (
          <span className="mono ml-auto hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground sm:inline-flex">
            <Info className="h-3 w-3" aria-hidden="true" />
            Best month: {best.label} {formatINR(best.net, { compact: true, signed: true })}
          </span>
        ) : null}
      </div>

      <div className="mt-4 h-[248px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <defs>
              <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 6" />
            <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
            <YAxis
              tick={axisStyle}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(value: number) => formatINR(value, { compact: true })}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--foreground) / 0.04)' }}
              content={
                <ChartTooltip
                  formatter={(value: number) => formatINR(value)}
                />
              }
            />
            {view === 'both' ? (
              <>
                <Bar dataKey="income" name="Income" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="expense" name="Spend" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} maxBarSize={26} />
              </>
            ) : null}
            <Area
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill={view === 'net' ? 'url(#netFill)' : 'transparent'}
              dot={false}
              activeDot={{ r: 3.5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="min-w-0 text-[11px] leading-snug text-muted-foreground">
          {current && previous ? (
            <>
              This month nets <span className="tabular font-medium text-foreground">{formatINR(current.net, { signed: true })}</span>{' '}
              after {formatINR(current.expense, { compact: true })} of spend.
              {previous.expense ? ` Spending is ${formatPct(changePct(current.expense, previous.expense), 0)} vs last month.` : ''}
            </>
          ) : (
            'Post a transaction to start the monthly series.'
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={onOpenIncomeExpense} className="w-full justify-center gap-1 text-[12px] sm:w-auto">
          Full breakdown
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} aria-hidden="true" />
      {label}
      <span className="tabular font-medium text-foreground">{value}</span>
    </span>
  );
}

type TrendKey = 'netWorth' | 'assets' | 'liabilities';

const trendMeta: Record<TrendKey, { label: string; color: string }> = {
  netWorth: { label: 'Net worth', color: 'hsl(var(--chart-1))' },
  assets: { label: 'Assets', color: 'hsl(var(--chart-2))' },
  liabilities: { label: 'Liabilities', color: 'hsl(var(--chart-3))' },
};

export function NetWorthTrendCard({ snapshots, rangeMonths }: { snapshots: NetWorthSnapshot[]; rangeMonths: number }) {
  const [key, setKey] = useState<TrendKey>('netWorth');
  const points = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        label: new Date(snapshot.date).toLocaleDateString('en-IN', { month: 'short' }),
        fullLabel: new Date(snapshot.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        netWorth: snapshot.netWorth,
        assets: snapshot.assets,
        liabilities: snapshot.liabilities,
      })),
    [snapshots]
  );
  const first = points[0]?.[key] ?? 0;
  const last = points[points.length - 1]?.[key] ?? 0;
  const change = changePct(last, first);
  const meta = trendMeta[key];

  return (
    <section className="panel flex flex-col p-5" aria-labelledby="trend-heading">
      <SectionHeading
        eyebrow="Trajectory"
        title="Net worth over time"
        description="Month-end balances from snapshots, with the current position appended live."
        action={<DeltaChip value={change} invert={key === 'liabilities'} suffix={`${rangeMonths} mo`} />}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="stat-value text-[24px] text-foreground">{formatINR(last)}</p>
        <span className="mono text-[11px] text-muted-foreground">
          {formatINR(last - first, { signed: true, compact: true })}{' '}
          {key === 'liabilities' ? 'change since' : 'added since'} {points[0]?.fullLabel ?? '—'}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface p-0.5" role="group" aria-label="Trend series">
          {(Object.keys(trendMeta) as TrendKey[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKey(option)}
              aria-pressed={key === option}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                key === option
                  ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(150_20%_10%/0.08)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {trendMeta[option].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`trend-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.26} />
                <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 6" />
            <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
            <YAxis
              tick={axisStyle}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(value: number) => formatINR(value, { compact: true })}
            />
            <Tooltip content={<ChartTooltip formatter={(value: number) => formatINR(value)} />} />
            <Area
              type="monotone"
              dataKey={key}
              name={meta.label}
              stroke={meta.color}
              strokeWidth={2.25}
              fill={`url(#trend-${key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function SpendingDonutCard({
  slices,
  total,
  monthLabel,
  onOpenTransactions,
}: {
  slices: CategorySlice[];
  total: number;
  monthLabel: string;
  onOpenTransactions: () => void;
}) {
  const top = slices.slice(0, 5);
  const rest = slices.slice(5);
  const data = rest.length
    ? [...top, { name: `Other (${rest.length})`, total: rest.reduce((sum, slice) => sum + slice.total, 0), previous: rest.reduce((sum, slice) => sum + slice.previous, 0), change: 0, share: 0, colorIndex: 5 }]
    : top;

  if (!data.length) {
    return (
      <section className="panel flex flex-col p-5" aria-labelledby="mix-heading">
        <SectionHeading eyebrow="Allocation" title="Where the money went" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-[13px] font-medium text-foreground">No spending recorded this month</p>
          <p className="max-w-[16rem] text-[12px] text-muted-foreground">Add an expense and the mix will chart itself here.</p>
          <Button variant="outline" size="sm" onClick={onOpenTransactions}>Add a transaction</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel flex flex-col p-5" aria-labelledby="mix-heading">
      <SectionHeading
        eyebrow="Allocation"
        title="Where the money went"
        description={`${monthLabel} spending by category.`}
        action={
          <button
            type="button"
            onClick={onOpenTransactions}
            className="text-[11px] font-medium text-primary transition-colors hover:text-primary-strong"
          >
            View all
          </button>
        }
      />
      <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-[168px] w-[168px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="name"
                innerRadius={58}
                outerRadius={80}
                paddingAngle={2}
                strokeWidth={0}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip formatter={(value: number) => formatINR(value)} hideLabel />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="eyebrow">Spent</span>
            <span className="stat-value mt-1 text-[20px] text-foreground">{formatINR(total, { compact: true })}</span>
          </div>
        </div>
        <ul className="w-full space-y-2.5">
          {data.map((slice, index) => (
            <li key={slice.name} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{slice.name}</span>
              <span className="tabular font-mono text-[11px] text-foreground">{formatINR(slice.total, { compact: true })}</span>
              <span
                className={cn(
                  'tabular w-12 text-right font-mono text-[10px]',
                  slice.change > 5 ? 'text-destructive' : slice.change < -5 ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {slice.previous && !slice.name.startsWith('Other') ? formatPct(slice.change, 0) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
