import { useMemo, useState } from 'react';
import { Plus, ReceiptText, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetAccounts, useGetNetWorthHistory, useGetTransactions } from '../hooks/useQueries';
import { useCachedMarketData } from '../hooks/useMarketData';
import { useAuth } from '../context/AuthContext';
import {
  buildCashflow,
  buildSignals,
  categoryBreakdown,
  changePct,
  detectRecurring,
  healthScore,
  RANGE_LABEL,
  RANGE_MONTHS,
  recentActivity,
  summarizeAccounts,
  type Range,
} from '../lib/finance';
import { cn } from '@/lib/utils';
import { ErrorState, SectionHeading, SkeletonBlock } from './overview/primitives';
import { BudgetPulseCard } from './overview/BudgetPulseCard';
import { HealthCompass, NetWorthHero, PageHeader, PulseGrid } from './overview/HeroAndPulse';
import { CashflowChartCard, NetWorthTrendCard, SpendingDonutCard } from './overview/Charts';
import { AccountsCard, ActivityCard, RecurringCard, SignalsCard } from './overview/Panels';

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
}

const ranges: Range[] = ['1M', '3M', '6M', '1Y'];
const rangeShort: Record<Range, string> = { '1M': '1M', '3M': '3M', '6M': '6M', '1Y': '1Y' };

function RangeControl({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
      role="group"
      aria-label="Reporting range"
    >
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          className={cn(
            'mono rounded-full px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors',
            value === range
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
          title={RANGE_LABEL[range]}
        >
          {rangeShort[range]}
        </button>
      ))}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading overview">
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-9 w-96 max-w-full" />
        <SkeletonBlock className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="panel h-[19rem] p-6 lg:col-span-8">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="mt-6 h-12 w-64" />
          <SkeletonBlock className="mt-8 h-12 w-full" />
        </div>
        <div className="panel h-[19rem] p-6 lg:col-span-4">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mx-auto mt-4 h-36 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="panel h-32 p-4">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-5 h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="panel h-80 p-5 lg:col-span-7">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-5 h-56 w-full" />
        </div>
        <div className="panel h-80 p-5 lg:col-span-5">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-5 h-56 w-full" />
        </div>
      </div>
    </div>
  );
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const accountsQuery = useGetAccounts();
  const transactionsQuery = useGetTransactions({ limit: 1000 });
  const historyQuery = useGetNetWorthHistory();
  const { getPrice } = useCachedMarketData();
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('6M');

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const snapshots = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  const marketAccounts = useMemo(
    () =>
      accounts.map((account) => {
        const subType = (account.subType ?? '').toLowerCase();
        const isInvestment = ['stock', 'mutual-fund', 'crypto', 'bond', 'etf'].includes(subType) && account.units;
        if (!isInvestment) return account;
        const price = account.symbol ? getPrice(account.symbol) : null;
        const unitPrice = price || Number(account.lastMarketPrice ?? 0);
        if (!unitPrice) return account;
        return { ...account, balance: String(unitPrice * Number(account.units) * 100) };
      }),
    [accounts, getPrice]
  );

  const fullCashflow = useMemo(() => buildCashflow(transactions, 12), [transactions]);
  const summary = useMemo(() => summarizeAccounts(marketAccounts, fullCashflow), [marketAccounts, fullCashflow]);
  const health = useMemo(() => healthScore(summary, fullCashflow), [summary, fullCashflow]);
  const { slices, total } = useMemo(() => categoryBreakdown(transactions), [transactions]);
  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);
  const activity = useMemo(() => recentActivity(transactions, 6), [transactions]);

  const signals = useMemo(
    () =>
      buildSignals({
        accounts: marketAccounts,
        transactions,
        cashflow: fullCashflow,
        recurring,
        categories: slices,
        summary,
        health,
      }),
    [marketAccounts, transactions, fullCashflow, recurring, slices, summary, health]
  );

  const priorSnapshots = useMemo(() => {
    const boundary = new Date();
    boundary.setHours(0, 0, 0, 0);
    return snapshots.filter((snapshot) => new Date(snapshot.date) < boundary);
  }, [snapshots]);
  const trendSnapshots = useMemo(
    () => [
      ...priorSnapshots,
      {
        date: new Date().toISOString(),
        netWorth: summary.netWorth,
        assets: summary.assets,
        liabilities: summary.liabilities,
      },
    ],
    [priorSnapshots, summary]
  );

  const months = RANGE_MONTHS[range];
  const visibleCashflow = useMemo(() => fullCashflow.slice(-Math.max(3, months)), [fullCashflow, months]);
  const visibleSnapshots = useMemo(() => trendSnapshots.slice(-Math.max(3, months)), [trendSnapshots, months]);
  const historySeries = useMemo(() => {
    const values = priorSnapshots.map((snapshot) => snapshot.netWorth).slice(-11);
    return [...values, summary.netWorth];
  }, [priorSnapshots, summary.netWorth]);

  const lastSnapshot = priorSnapshots[priorSnapshots.length - 1];
  const netWorthChange = lastSnapshot ? summary.netWorth - lastSnapshot.netWorth : 0;
  const netWorthChangePct = lastSnapshot ? changePct(summary.netWorth, lastSnapshot.netWorth) : 0;

  const current = fullCashflow[fullCashflow.length - 1];
  const previous = fullCashflow[fullCashflow.length - 2];
  const savingsRate = current?.income ? ((current.income - current.expense) / current.income) * 100 : 0;
  const previousRate = previous?.income ? ((previous.income - previous.expense) / previous.income) * 100 : null;
  const savingsChange = previousRate === null ? null : changePct(savingsRate, previousRate);

  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

  const loading = accountsQuery.isLoading || transactionsQuery.isLoading;
  const failed = accountsQuery.isError || transactionsQuery.isError;
  const retry = () => {
    if (accountsQuery.isError) void accountsQuery.refetch();
    if (transactionsQuery.isError) void transactionsQuery.refetch();
    if (historyQuery.isError) void historyQuery.refetch();
  };

  if (loading) return <OverviewSkeleton />;

  if (failed) {
    return <ErrorState title="The overview could not load" onRetry={retry} />;
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          rangeControl={<RangeControl value={range} onChange={setRange} />}
          onNewTransaction={() => onNavigate?.('transactions')}
        />
        <section className="panel relative overflow-hidden p-6 sm:p-10">
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="relative max-w-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-panel border border-primary/30 bg-primary-soft">
              <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
              Start the compass with one account
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Add the bank account you actually use. Net worth, cash flow and every signal on this page
              are computed from that ledger — nothing leaves your server.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => onNavigate?.('accounts')} className="gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add a bank account
              </Button>
              <Button variant="outline" onClick={() => onNavigate?.('transactions')} className="gap-1.5">
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                Log a transaction
              </Button>
            </div>
            <p className="mono mt-6 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Signed in as {user?.email ?? 'your account'}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        rangeControl={<RangeControl value={range} onChange={setRange} />}
        onNewTransaction={() => onNavigate?.('transactions')}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <NetWorthHero
            netWorth={summary.netWorth}
            changePct={netWorthChangePct}
            changeValue={netWorthChange}
            assets={summary.assets}
            liabilities={summary.liabilities}
            series={historySeries}
            onOpenAccounts={() => onNavigate?.('accounts')}
          />
        </div>
        <div className="lg:col-span-4">
          <HealthCompass health={health} />
        </div>
      </div>

      <PulseGrid cashflow={fullCashflow} savingsRate={savingsRate} savingsChange={savingsChange} />
      <BudgetPulseCard onOpen={() => onNavigate?.('budgets')} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <CashflowChartCard series={visibleCashflow} onOpenIncomeExpense={() => onNavigate?.('income-expense')} />
        </div>
        <div className="lg:col-span-5">
          <SpendingDonutCard
            slices={slices}
            total={total}
            monthLabel={monthName}
            onOpenTransactions={() => onNavigate?.('transactions')}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <NetWorthTrendCard snapshots={visibleSnapshots} rangeMonths={months} />
        </div>
        <div className="lg:col-span-5">
          <SignalsCard signals={signals} onNavigate={(tab) => onNavigate?.(tab)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <RecurringCard recurring={recurring} onOpenTransactions={() => onNavigate?.('transactions')} />
        </div>
        <div className="lg:col-span-4">
          <ActivityCard items={activity} onOpenTransactions={() => onNavigate?.('transactions')} />
        </div>
        <div className="lg:col-span-3">
          <AccountsCard accounts={marketAccounts} summary={summary} onOpenAccounts={() => onNavigate?.('accounts')} />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading
          eyebrow="Method"
          title="Every figure here is computed from your ledger"
          className="flex-1"
        />
        <p className="mono max-w-md text-[10px] leading-relaxed text-muted-foreground sm:text-right">
          Spending mixes current-month debits; cash flow uses posted splits; recurring charges need three
          steady monthly payments. Snapshot may lag by one day during market sessions.
        </p>
      </div>
    </div>
  );
}
