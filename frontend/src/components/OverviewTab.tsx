import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useGetAccounts } from '../hooks/useQueries';
import { useCachedMarketData } from '../hooks/useMarketData';
import { useAuth } from '../context/AuthContext';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Plus, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { InteractivePieChart } from './charts/InteractivePieChart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { NetWorthChart } from './NetWorthChart';

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
}

function StatCell({
  label,
  value,
  note,
  chip,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  chip: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
  onClick?: () => void;
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-success'
      : tone === 'negative'
        ? 'text-destructive'
        : tone === 'accent'
          ? 'text-primary'
          : 'text-foreground';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[7.5rem] w-full flex-col justify-between gap-3 bg-card px-5 py-4 text-left transition-colors duration-150 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {chip}
        </span>
      </span>
      <span className="flex flex-col gap-1">
        <span className={`tabular text-[1.375rem] font-semibold leading-none tracking-[-0.02em] ${toneClass}`}>
          {value}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">{note}</span>
      </span>
      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        Open <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { data: accounts, isLoading } = useGetAccounts();
  const { user } = useAuth();
  const { getPrice } = useCachedMarketData();
  const [showNetWorthDetails, setShowNetWorthDetails] = useState(false);
  const [showAssetDetails, setShowAssetDetails] = useState(false);
  const isChainingDialogRef = useRef(false);
  const keepFocusWhenChaining = () => {
    // Closing one dialog while opening another: skip the focus return to the
    // detached trigger so the newly opened dialog receives focus.
    isChainingDialogRef.current = true;
  };
  const handleDialogCloseAutoFocus = (event: Event) => {
    if (isChainingDialogRef.current) {
      event.preventDefault();
      isChainingDialogRef.current = false;
    }
  };

  const assetAccounts = useMemo(() => accounts?.filter(a => a.type === 'ASSET') || [], [accounts]);
  const liabilityAccounts = useMemo(() => accounts?.filter(a => a.type === 'LIABILITY') || [], [accounts]);

  const calculateMarketValue = (account: any) => {
    if (['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'].includes(account.subType) && account.units) {
      if (account.symbol) {
        const price = getPrice(account.symbol);
        if (price) {
          return price * account.units * 100;
        }
      }

      if (account.lastMarketPrice) {
        return Number(account.lastMarketPrice) * account.units * 100;
      }
    }
    return Number(account.balance);
  };

  const assetAllocationData = useMemo(() => {
    const allocation: Record<string, number> = {};

    assetAccounts.forEach(acc => {
      const type = acc.subType ? acc.subType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other';
      const value = calculateMarketValue(acc);
      allocation[type] = (allocation[type] || 0) + value;
    });

    return Object.entries(allocation)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [assetAccounts]); // getPrice is stable from hook

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date()).toUpperCase();

  const firstName = (user?.name || 'there').split(' ')[0];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-3">
          <div className="h-2.5 w-40 rounded-sm shimmer" />
          <div className="h-9 w-72 max-w-full rounded-control shimmer" />
        </div>
        <div className="h-44 rounded-panel border border-border bg-card p-6">
          <div className="h-2.5 w-32 rounded-sm shimmer" />
          <div className="mt-5 h-9 w-56 rounded-sm shimmer" />
          <div className="mt-4 h-3 w-40 rounded-sm shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border bg-border lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-card p-5">
              <div className="h-2.5 w-16 rounded-sm shimmer" />
              <div className="mt-6 h-6 w-24 rounded-sm shimmer" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="h-[22rem] rounded-panel border border-border bg-card shimmer lg:col-span-3" />
          <div className="h-[22rem] rounded-panel border border-border bg-card shimmer lg:col-span-2" />
        </div>
      </div>
    );
  }

  const totalAssetsBook = assetAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalAssetsMarket = assetAccounts.reduce((sum, acc) => sum + calculateMarketValue(acc), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + Math.abs(Number(acc.balance)), 0);

  const netWorthBook = totalAssetsBook - totalLiabilities;
  const netWorthMarket = totalAssetsMarket - totalLiabilities;

  const cashAccounts = assetAccounts.filter(a => ['cash', 'wallet', 'savings', 'current'].includes(a.subType?.toLowerCase() || ''));
  const investmentAccounts = assetAccounts.filter(a => !['cash', 'wallet', 'savings', 'current'].includes(a.subType?.toLowerCase() || ''));

  const totalCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalInvestmentsBook = investmentAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalInvestmentsMarket = investmentAccounts.reduce((sum, acc) => sum + calculateMarketValue(acc), 0);

  const marketDelta = netWorthMarket - netWorthBook;
  const marketDeltaPct = netWorthBook !== 0 ? (marketDelta / Math.abs(netWorthBook)) * 100 : 0;
  const hasAccounts = (accounts?.length ?? 0) > 0;

  if (!hasAccounts) {
    return (
      <div className="space-y-6">
        <div>
          <p className="eyebrow mb-3">{today} · SYSTEM · LIVE</p>
          <h1 className="text-display-sm text-foreground">{greeting}, {firstName}.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Your ledger is empty. Add the accounts you actually use — one bank account is enough to start.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-panel border border-border bg-card">
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative flex flex-col items-start gap-5 px-6 py-14 sm:px-10">
            <span className="flex h-11 w-11 items-center justify-center rounded-control border border-primary/30 bg-primary-soft">
              <Wallet className="h-5 w-5 text-primary" />
            </span>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">Start with one account</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Net worth, allocation and cash flow are computed from your accounts and their transactions.
                Nothing is sent anywhere — the ledger lives on your server.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onNavigate?.('accounts')}>
                <Plus className="h-4 w-4" />
                Add a bank account
              </Button>
              <Button variant="outline" onClick={() => onNavigate?.('transactions')}>
                <ReceiptText className="h-4 w-4" />
                Log a transaction
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">{today} · SYSTEM · LIVE</p>
          <h1 className="text-display-sm text-foreground">{greeting}, {firstName}.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Net worth, allocation and momentum in one grid. Figures in INR.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onNavigate?.('transactions')}>
            <ReceiptText className="h-4 w-4" />
            Log transaction
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('accounts')}>
            <Plus className="h-4 w-4" />
            Add account
          </Button>
        </div>
      </div>

      {/* Net worth hero */}
      <section className="relative overflow-hidden rounded-panel border border-border bg-card shadow-panel" aria-label="Net worth">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Net worth · market value</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                {totalLiabilities > 0 ? 'Solvent' : 'Debt free'}
              </span>
            </div>
            <p className="tabular mt-3 text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-semibold leading-none tracking-tightest text-foreground">
              {formatCurrency(netWorthMarket)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Book</span>
                <span className="tabular font-medium text-foreground">{formatCurrency(netWorthBook)}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] ${marketDelta >= 0 ? 'text-success' : 'text-destructive'}`}
              >
                {marketDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {marketDelta >= 0 ? 'Unrealised gain' : 'Unrealised loss'} {formatCurrency(Math.abs(marketDelta))} ({Math.abs(marketDeltaPct).toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowNetWorthDetails(true)}>
              Breakdown
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAssetDetails(true)}>
              Assets
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('investments')}>
              Investments
            </Button>
          </div>
        </div>
      </section>

      {/* Stat band */}
      <section aria-label="Position" className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCell
          label="Total assets"
          chip="Market"
          value={formatCurrency(totalAssetsMarket)}
          note={`Cash ${formatCurrency(totalCash)} · Investments ${formatCurrency(totalInvestmentsMarket)}`}
          tone="positive"
          onClick={() => setShowAssetDetails(true)}
        />
        <StatCell
          label="Liabilities"
          chip="Owed"
          value={formatCurrency(totalLiabilities)}
          note={liabilityAccounts.length > 0 ? `${liabilityAccounts.length} account${liabilityAccounts.length === 1 ? '' : 's'} with outstanding debt` : 'No debt recorded'}
          tone="negative"
          onClick={() => onNavigate?.('debts')}
        />
        <StatCell
          label="Liquid cash"
          chip="Available"
          value={formatCurrency(totalCash)}
          note="Across bank, cash and wallet accounts"
          tone="accent"
          onClick={() => onNavigate?.('accounts')}
        />
        <StatCell
          label="Investments"
          chip="At market"
          value={formatCurrency(totalInvestmentsMarket)}
          note={`Book ${formatCurrency(totalInvestmentsBook)} · ${investmentAccounts.length} holding${investmentAccounts.length === 1 ? '' : 's'}`}
          onClick={() => onNavigate?.('investments')}
        />
      </section>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <NetWorthChart />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <p className="eyebrow mb-1.5">Allocation</p>
              <CardTitle>Where the money sits</CardTitle>
            </div>
            <span className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {assetAllocationData.length} classes
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {assetAllocationData.length > 0 ? (
                <InteractivePieChart
                  data={assetAllocationData}
                  formatter={formatCurrency}
                  colors={[
                    'hsl(var(--chart-1))',
                    'hsl(var(--chart-2))',
                    'hsl(var(--chart-3))',
                    'hsl(var(--chart-4))',
                    'hsl(var(--chart-5))',
                    'hsl(var(--primary))',
                    'hsl(var(--muted-foreground))',
                  ]}
                  centerText={{
                    title: 'Total assets',
                    value: formatCurrency(totalAssetsMarket),
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-control border border-dashed border-border text-center">
                  <p className="text-sm font-medium text-foreground">Nothing allocated yet</p>
                  <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                    Add a savings, stock or crypto account and the split appears here.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => onNavigate?.('accounts')}>
                    Add an account
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showNetWorthDetails} onOpenChange={setShowNetWorthDetails}>
        <DialogContent onCloseAutoFocus={handleDialogCloseAutoFocus}>
          <DialogHeader>
            <p className="eyebrow mb-1">Reconciliation</p>
            <DialogTitle>Net worth breakdown</DialogTitle>
            <DialogDescription>
              Net worth is total assets at market value minus total liabilities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface p-4">
              <div className="space-y-1">
                <p className="eyebrow">Total assets</p>
                <p className="tabular text-xl font-semibold text-success">{formatCurrency(totalAssetsMarket)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { keepFocusWhenChaining(); setShowNetWorthDetails(false); setShowAssetDetails(true); }}>
                Breakdown <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface p-4">
              <div className="space-y-1">
                <p className="eyebrow">Total liabilities</p>
                <p className="tabular text-xl font-semibold text-destructive">{formatCurrency(totalLiabilities)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setShowNetWorthDetails(false); onNavigate?.('debts'); }}>
                View debts <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-baseline justify-between gap-3 rounded-control border border-primary/20 bg-primary-soft px-4 py-3">
              <span className="eyebrow text-primary/80">Net worth</span>
              <span className="tabular text-lg font-semibold text-primary">{formatCurrency(netWorthMarket)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssetDetails} onOpenChange={setShowAssetDetails}>
        <DialogContent onCloseAutoFocus={handleDialogCloseAutoFocus}>
          <DialogHeader>
            <p className="eyebrow mb-1">Composition</p>
            <DialogTitle>Total assets breakdown</DialogTitle>
            <DialogDescription>
              Assets split between liquid cash and held investments. Investments show market value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface p-4">
              <div className="space-y-1">
                <p className="eyebrow">Bank &amp; cash</p>
                <p className="tabular text-xl font-semibold text-primary">{formatCurrency(totalCash)}</p>
                <p className="text-xs text-muted-foreground">Liquid funds available to spend</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { keepFocusWhenChaining(); setShowAssetDetails(false); onNavigate?.('accounts'); }}>
                Accounts <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface p-4">
              <div className="space-y-1">
                <p className="eyebrow">Investments</p>
                <p className="tabular text-xl font-semibold text-success">{formatCurrency(totalInvestmentsMarket)}</p>
                <p className="text-xs text-muted-foreground">Stocks, mutual funds, crypto and more</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { keepFocusWhenChaining(); setShowAssetDetails(false); onNavigate?.('investments'); }}>
                Holdings <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
