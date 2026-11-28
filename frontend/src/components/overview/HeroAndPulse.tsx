import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Landmark, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/finance';
import type { CashflowPoint, HealthScore } from '@/lib/finance';
import { CompassGauge, DeltaChip, MeterRow, SectionHeading, Sparkline, ToneDot } from './primitives';
import { Money } from '@/components/system/Money';

export function PageHeader({
  rangeControl,
  onNewTransaction,
}: {
  rangeControl: ReactNode;
  onNewTransaction: () => void;
}) {
  return (
    <header className="flex flex-col gap-5 pb-1 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow flex items-center gap-2">
          <ToneDot tone="positive" />
          Net worth · this month
        </p>
        <h1 className="mt-3 text-headline text-balance text-foreground">
          Your money, in one calm, honest view.
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Every double-entry ledger behind one clear number — assets, debts and this month's
          spending grouped by what they mean, so the next decision starts from evidence.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rangeControl}
        <Button size="sm" onClick={onNewTransaction} className="gap-1.5">
          New transaction
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}

export function NetWorthHero({
  netWorth,
  changePct,
  changeValue,
  assets,
  liabilities,
  series,
  onOpenAccounts,
}: {
  netWorth: number;
  changePct: number;
  changeValue: number;
  assets: number;
  liabilities: number;
  series: number[];
  onOpenAccounts: () => void;
}) {
  const debtShare = assets + liabilities > 0 ? (liabilities / (assets + liabilities)) * 100 : 0;
  return (
    <section className="glow-balance panel relative overflow-hidden p-5 sm:p-7" aria-labelledby="net-worth-heading">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/25 bg-card/80">
              <Landmark className="h-3 w-3 text-primary" aria-hidden="true" />
            </span>
            <h2 id="net-worth-heading" className="eyebrow text-primary-strong">
              Net worth · every account
            </h2>
          </div>
          <span className="mono rounded-full border border-border bg-card/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            as of today
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <p className="stat-hero text-[clamp(2.6rem,2rem+3vw,3.9rem)] text-foreground">
            <Money paise={netWorth} animate />
          </p>
          <div className="flex flex-col gap-1.5 pb-1">
            <DeltaChip value={changePct} suffix="vs last month" />
            <span className="mono text-[11px] text-muted-foreground">
              {formatINR(changeValue, { signed: true })} in 30 days
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:items-end">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="eyebrow">Assets</p>
              <p className="stat-value mt-1.5 text-[19px] text-foreground">{formatINR(assets, { compact: true })}</p>
              <p className="mono mt-0.5 text-[10px] text-muted-foreground">
                {formatINR(assets)}
              </p>
            </div>
            <div>
              <p className="eyebrow">Liabilities</p>
              <p className="stat-value mt-1.5 text-[19px] text-foreground">{formatINR(liabilities, { compact: true })}</p>
              <p className="mono mt-0.5 text-[10px] text-muted-foreground">{formatINR(liabilities)}</p>
            </div>
          </div>
          <div>
            <Sparkline
              values={series.slice(-12)}
              tone="positive"
              width={200}
              height={48}
              className="h-12 w-full"
              ariaLabel="Net worth over the last twelve months"
            />
            <p className="sr-only">Assets against debt</p>
            <div className="mt-3 flex items-center justify-end text-[10px] text-muted-foreground">
              <span className="mono whitespace-nowrap">{debtShare.toFixed(0)}% debt</span>
            </div>
            <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span className="h-full bg-chart-1" style={{ width: `${100 - debtShare}%` }} />
              <span className="h-full bg-chart-3/70" style={{ width: `${debtShare}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
          <Button variant="outline" size="sm" onClick={onOpenAccounts} className="gap-1.5">
            Open accounts
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <span className="mono ml-auto hidden text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
            INR · live ledger
          </span>
        </div>
      </div>
    </section>
  );
}

export function HealthCompass({ health }: { health: HealthScore }) {
  return (
    <section className="panel mt-4 flex h-full flex-col p-5 sm:p-6 lg:mt-0" aria-labelledby="health-heading">
      <SectionHeading
        eyebrow="Compass"
        title="Financial health"
        description="A weighted read on savings, debt and cash buffer."
      />
      <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-4 py-2 sm:flex-row lg:flex-col xl:flex-row">
        <CompassGauge score={health.score} band={health.band} />
        <div className="w-full flex-1 space-y-3">
          <MeterRow
            label="Savings rate"
            value={health.parts[0].value}
            max={40}
            detail={health.parts[0].detail}
            color="hsl(var(--chart-1))"
          />
          <MeterRow
            label="Debt load"
            value={health.parts[1].value}
            max={30}
            detail={health.parts[1].detail}
            color="hsl(var(--chart-3))"
          />
          <MeterRow
            label="Cash buffer"
            value={health.parts[2].value}
            max={30}
            detail={health.parts[2].detail}
            color="hsl(var(--chart-2))"
          />
        </div>
      </div>
      <p className="mt-3 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Score = 40% savings rate + 30% debt-to-asset + 30% months of cash. It moves with your ledger,
        not a credit bureau.
      </p>
    </section>
  );
}

type PulseTone = 'in' | 'out' | 'net' | 'save';

const pulseMeta: Record<PulseTone, { label: string; icon: typeof TrendingUp; invert: boolean }> = {
  in: { label: 'Cash in', icon: TrendingUp, invert: false },
  out: { label: 'Cash out', icon: TrendingDown, invert: true },
  net: { label: 'Net flow', icon: ArrowUpRight, invert: false },
  save: { label: 'Savings rate', icon: PiggyBank, invert: false },
};

export function PulseCard({
  tone,
  value,
  change,
  series,
  hint,
}: {
  tone: PulseTone;
  value: string;
  change: number | null;
  series: number[];
  hint: string;
}) {
  const meta = pulseMeta[tone];
  const Icon = meta.icon;
  return (
    <article className="panel group relative overflow-hidden p-4 transition-colors duration-200 hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-control border',
              tone === 'out'
                ? 'border-destructive/20 bg-destructive/10 text-destructive'
                : 'border-primary/20 bg-primary-soft text-primary-strong'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h3 className="text-[12px] font-medium text-muted-foreground">{meta.label}</h3>
        </div>
        <DeltaChip value={change} invert={meta.invert} />
      </div>
      <p className="stat-value mt-3 text-stat text-foreground">{value}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{hint}</span>
        <Sparkline
          values={series}
          tone={tone === 'out' ? 'warning' : tone === 'save' ? 'positive' : 'neutral'}
          width={84}
          height={26}
          className="h-6 w-20 shrink-0"
          ariaLabel={`${meta.label} trend, last six months`}
        />
      </div>
    </article>
  );
}

export function PulseGrid({
  cashflow,
  savingsRate,
  savingsChange,
}: {
  cashflow: CashflowPoint[];
  savingsRate: number;
  savingsChange: number | null;
}) {
  const current = cashflow[cashflow.length - 1];
  const previous = cashflow[cashflow.length - 2];
  const pct = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
  const rates = cashflow.map((month) => (month.income ? ((month.income - month.expense) / month.income) * 100 : 0));
  return (
    <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
      <PulseCard
        tone="in"
        value={formatINR(current?.income ?? 0, { compact: true })}
        change={current && previous ? pct(current.income, previous.income) : null}
        series={cashflow.map((month) => month.income)}
        hint={current?.label ?? '—'}
      />
      <PulseCard
        tone="out"
        value={formatINR(current?.expense ?? 0, { compact: true })}
        change={current && previous ? pct(current.expense, previous.expense) : null}
        series={cashflow.map((month) => month.expense)}
        hint={current?.label ?? '—'}
      />
      <PulseCard
        tone="net"
        value={formatINR(current?.net ?? 0, { compact: true, signed: true })}
        change={current && previous ? pct(current.net, previous.net) : null}
        series={cashflow.map((month) => month.net)}
        hint="Income − spend"
      />
      <PulseCard
        tone="save"
        value={`${savingsRate.toFixed(0)}%`}
        change={savingsChange}
        series={rates}
        hint="target 30%"
      />
    </div>
  );
}
