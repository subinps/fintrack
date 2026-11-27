import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Car,
  CircleAlert,
  Coffee,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Plane,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  dayLabel,
  formatINR,
  type AccountSummary,
  type ActivityItem,
  type RecurringPayment,
  type Signal,
} from '@/lib/finance';
import type { Account } from '@/hooks/useQueries';
import { SectionHeading, ToneDot } from './primitives';

export function categoryIcon(name: string): LucideIcon {
  const key = name.toLowerCase();
  if (key.includes('rent') || key.includes('housing')) return Home;
  if (key.includes('grocer')) return ShoppingBasket;
  if (key.includes('dining') || key.includes('cafe') || key.includes('coffee')) return Coffee;
  if (key.includes('transport') || key.includes('fuel') || key.includes('travel')) return key.includes('travel') ? Plane : Car;
  if (key.includes('utilit') || key.includes('electric') || key.includes('internet')) return Zap;
  if (key.includes('shop')) return ShoppingBag;
  if (key.includes('health') || key.includes('medical')) return HeartPulse;
  if (key.includes('entertain') || key.includes('stream')) return Clapperboard;
  if (key.includes('insur')) return ShieldCheck;
  if (key.includes('educat')) return GraduationCap;
  if (key.includes('invest') || key.includes('salary') || key.includes('income')) return TrendingUp;
  return Wallet;
}

const toneStyles = {
  critical: { ring: 'border-destructive/25 bg-destructive/10 text-destructive', dot: 'critical' },
  warning: { ring: 'border-warning/25 bg-warning/10 text-warning', dot: 'warning' },
  positive: { ring: 'border-success/25 bg-success/10 text-success', dot: 'positive' },
  neutral: { ring: 'border-border bg-surface text-muted-foreground', dot: 'neutral' },
} as const;

const signalIcons = {
  trend: TrendingUp,
  repeat: Repeat,
  calendar: CircleAlert,
  shield: ShieldCheck,
  flame: Zap,
  wallet: Wallet,
} as const;

export function SignalsCard({
  signals,
  onNavigate,
}: {
  signals: Signal[];
  onNavigate: (tab: string) => void;
}) {
  const urgent = signals.filter((signal) => signal.tone === 'critical' || signal.tone === 'warning').length;
  return (
    <section className="panel flex h-full flex-col p-5" aria-labelledby="signals-heading" id="signals">
      <SectionHeading
        eyebrow="Signals"
        title="What needs a look"
        description="Computed from this month's ledger, ranked by urgency."
        action={
          <span className="mono rounded-full border border-border bg-surface px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {urgent} open
          </span>
        }
      />
      {signals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <ToneDot tone="positive" />
          <p className="text-[13px] font-medium text-foreground">Nothing needs a look</p>
          <p className="max-w-[15rem] text-[12px] text-muted-foreground">
            Spending, savings and debt are all inside their bands this month.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border/70">
          {signals.map((signal) => {
            const style = toneStyles[signal.tone];
            const Icon = signalIcons[signal.icon];
            return (
              <li key={signal.id} className="group py-3 first:pt-0 last:pb-0">
                <div className="flex gap-3">
                  <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control border', style.ring)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{signal.tag}</span>
                      <ToneDot tone={signal.tone} />
                    </div>
                    <p className="mt-0.5 text-[13px] font-medium leading-snug text-foreground">{signal.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{signal.detail}</p>
                    <button
                      type="button"
                      onClick={() => onNavigate(signal.action.tab)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary-strong"
                    >
                      {signal.action.label}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RecurringCard({
  recurring,
  onOpenTransactions,
}: {
  recurring: RecurringPayment[];
  onOpenTransactions: () => void;
}) {
  const commitment = recurring.reduce((sum, item) => sum + item.amount, 0);
  return (
    <section className="panel flex h-full flex-col p-5" aria-labelledby="recurring-heading">
      <SectionHeading
        eyebrow="Commitments"
        title="Recurring payments"
        description="Merchants charged three or more times on a steady monthly amount."
        action={
          <span className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <Repeat className="h-3 w-3" aria-hidden="true" />
            {recurring.length}
          </span>
        }
      />
      {recurring.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <p className="text-[13px] font-medium text-foreground">No recurring charges detected yet</p>
          <p className="max-w-[16rem] text-[12px] text-muted-foreground">
            Three matching monthly charges and this card fills itself in.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-border/70">
            {recurring.slice(0, 5).map((item) => {
              const Icon = categoryIcon(item.category);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{item.merchant}</p>
                    <p className="mono text-[10px] text-muted-foreground">
                      {item.category} · next {new Date(item.nextDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-mono text-[12px] text-foreground">{formatINR(item.amount)}</p>
                    {Math.abs(item.amount - item.previousAmount) > item.amount * 0.02 ? (
                      <p className="mono text-[10px] text-warning">
                        was {formatINR(item.previousAmount, { compact: true })}
                      </p>
                    ) : (
                      <p className="mono text-[10px] text-muted-foreground">monthly</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
            <div>
              <p className="eyebrow">Monthly commitment</p>
              <p className="stat-value mt-1 text-[18px] text-foreground">{formatINR(commitment)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onOpenTransactions} className="gap-1 text-[12px]">
              Inspect
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export function ActivityCard({
  items,
  onOpenTransactions,
}: {
  items: ActivityItem[];
  onOpenTransactions: () => void;
}) {
  return (
    <section className="panel flex h-full flex-col p-5" aria-labelledby="activity-heading">
      <SectionHeading
        eyebrow="Ledger"
        title="Latest activity"
        description="The last entries posted across every account."
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
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <p className="text-[13px] font-medium text-foreground">Your ledger is empty</p>
          <p className="max-w-[15rem] text-[12px] text-muted-foreground">Record the first transaction and this feed comes alive.</p>
          <Button variant="outline" size="sm" onClick={onOpenTransactions}>Add a transaction</Button>
        </div>
      ) : (
        <ul className="mt-3 flex-1 divide-y divide-border/70">
          {items.map((item) => {
            const Icon = categoryIcon(item.primary.name);
            const isIncome = item.transaction.splits?.some(
              (split) => split.account?.type === 'INCOME' && Number(split.amount) < 0
            );
            return (
              <li key={item.transaction.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">{item.transaction.description}</p>
                  <p className="mono text-[10px] text-muted-foreground">
                    {dayLabel(item.transaction.date)} · {item.primary.name}
                  </p>
                </div>
                <span
                  className={cn(
                    'tabular shrink-0 font-mono text-[12px] font-medium',
                    isIncome ? 'text-success' : 'text-foreground'
                  )}
                >
                  {isIncome ? formatINR(item.primary.amount, { signed: true }) : formatINR(-item.primary.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function AccountsCard({
  accounts,
  summary,
  onOpenAccounts,
}: {
  accounts: Account[];
  summary: AccountSummary;
  onOpenAccounts: () => void;
}) {
  const assets = accounts
    .filter((account) => account.type === 'ASSET')
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .slice(0, 4);
  const rows = [
    { label: 'Liquid', value: summary.liquid, color: 'hsl(var(--chart-1))' },
    { label: 'Invested', value: summary.invested, color: 'hsl(var(--chart-2))' },
    { label: 'Owed', value: summary.liabilities, color: 'hsl(var(--chart-3))' },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;

  return (
    <section className="panel flex h-full flex-col p-5" aria-labelledby="accounts-heading">
      <SectionHeading
        eyebrow="Balance sheet"
        title="Accounts"
        description="Where value sits right now."
        action={
          <button
            type="button"
            onClick={onOpenAccounts}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary-strong"
          >
            Manage
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </button>
        }
      />
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {rows.map((row) => (
          <span key={row.label} className="h-full" style={{ width: `${(row.value / total) * 100}%`, background: row.color }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="mono flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} aria-hidden="true" />
              {row.label}
            </dt>
            <dd className="tabular mt-1 font-mono text-[11px] text-foreground">{formatINR(row.value, { compact: true })}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 flex-1 space-y-1 border-t border-border/70 pt-3">
        {assets.length === 0 ? (
          <li className="flex flex-col gap-2 py-3">
            <p className="text-[12px] text-muted-foreground">No asset accounts yet.</p>
            <Button variant="outline" size="sm" onClick={onOpenAccounts} className="w-fit gap-1">
              <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
              Add an account
            </Button>
          </li>
        ) : (
          assets.map((account) => (
            <li key={account.id} className="flex items-center justify-between gap-2 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground">
                  {account.symbol ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : account.subType?.toLowerCase().includes('cash') ? <Banknote className="h-3.5 w-3.5" aria-hidden="true" /> : <Landmark className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-foreground">{account.name}</p>
                  <p className="mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">{account.subType ?? account.type}</p>
                </div>
              </div>
              <span className="tabular shrink-0 font-mono text-[11.5px] text-foreground">
                {formatINR(Number(account.balance), { compact: true })}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
