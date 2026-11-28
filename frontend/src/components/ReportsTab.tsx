import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowDownRight, ArrowUpRight, Download, FileText, Printer, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '../lib/api';
import { useBalanceSheet, useCashFlow, useProfitAndLoss, useTrialBalance, type PnlLine } from '../hooks/useFinance';

const money = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const signed = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n) || n === 0) return money(0);
  return `${n < 0 ? '−' : ''}${money(n)}`;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

const presets = () => {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfQuarter = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return [
    { id: 'month', label: 'This month', from: iso(startOfMonth), to: iso(now) },
    { id: 'quarter', label: 'This quarter', from: iso(startOfQuarter), to: iso(now) },
    { id: 'year', label: 'This year', from: iso(startOfYear), to: iso(now) },
  ];
};

export function ReportsTab() {
  const rangePresets = useMemo(presets, []);
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState(rangePresets[0].from);
  const [to, setTo] = useState(rangePresets[0].to);
  const [compare, setCompare] = useState(true);
  const [tab, setTab] = useState('pnl');

  const choose = (id: string) => {
    const chosen = rangePresets.find((item) => item.id === id);
    if (!chosen) return;
    setPreset(id);
    setFrom(chosen.from);
    setTo(chosen.to);
  };

  const exportCsv = async (rows: (string | number)[][], name: string) => {
    try {
      const response = await api.post('/reports/export-csv', { rows }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}-${to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded.');
    } catch {
      toast.error('Could not export that report.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Statements</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Reports</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Four statements built from your ledger the moment you load them. Pick a period, compare it with the one before, and export anything as CSV.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-border bg-card p-0.5">
              {rangePresets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choose(item.id)}
                  aria-pressed={preset === item.id}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    preset === item.id ? 'bg-primary-soft text-primary-strong' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="date"
                value={from}
                onChange={(event) => { setFrom(event.target.value); setPreset('custom'); }}
                className="h-9 rounded-control border border-border bg-card px-2 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Period start"
              />
              →
              <input
                type="date"
                value={to}
                onChange={(event) => { setTo(event.target.value); setPreset('custom'); }}
                className="h-9 rounded-control border border-border bg-card px-2 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Period end"
              />
            </label>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:inline-flex">
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
          <TabsTrigger value="pnl">Profit & loss</TabsTrigger>
          <TabsTrigger value="balance">Balance sheet</TabsTrigger>
          <TabsTrigger value="cash">Cash flow</TabsTrigger>
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="mt-4">
          <PnlPanel from={from} to={to} compare={compare} setCompare={setCompare} onExport={exportCsv} />
        </TabsContent>
        <TabsContent value="balance" className="mt-4">
          <BalancePanel asOf={to} onExport={exportCsv} />
        </TabsContent>
        <TabsContent value="cash" className="mt-4">
          <CashPanel from={from} to={to} onExport={exportCsv} />
        </TabsContent>
        <TabsContent value="trial" className="mt-4">
          <TrialPanel asOf={to} onExport={exportCsv} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function LineTable({ title, lines, total, totalLabel, tone }: { title: string; lines: PnlLine[]; total: string; totalLabel: string; tone: 'income' | 'expense' | 'neutral' }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      {lines.length === 0 ? (
        <p className="rounded-control border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing posted in this period.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-control border border-border">
          {lines.map((line) => (
            <li key={line.accountId} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate text-sm text-foreground">{line.name}</span>
              <span className={cn('font-mono text-sm tabular-nums', tone === 'income' ? 'text-success' : 'text-foreground')}>
                {signed(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-border-strong pt-2 text-sm font-semibold">
        <span className="text-muted-foreground">{totalLabel}</span>
        <span className={cn('font-mono tabular-nums', tone === 'income' ? 'text-success' : 'text-foreground')}>{signed(total)}</span>
      </div>
    </div>
  );
}

function PnlPanel({ from, to, compare, setCompare, onExport }: { from: string; to: string; compare: boolean; setCompare: (value: boolean) => void; onExport: (rows: (string | number)[][], name: string) => void }) {
  const { data, isLoading, isError, refetch } = useProfitAndLoss(from, to, compare);

  if (isLoading) return <Skeleton className="h-96 w-full rounded-panel" />;
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-2 py-10">
          <FileText className="h-5 w-5 text-danger" />
          <p className="text-sm font-medium">The statement could not be built.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const net = Number(data.netProfit);
  const rows: (string | number)[][] = [
    ['Profit and loss', `${data.from} to ${data.to}`],
    ['Account', 'Amount (INR)'],
    ...data.income.map((line) => [line.name, Number(line.amount)]),
    ['Total income', Number(data.totalIncome)],
    ...data.expenses.map((line) => [line.name, Number(line.amount)]),
    ['Total expenses', Number(data.totalExpenses)],
    ['Net profit', net],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Income" value={money(data.totalIncome)} tone="positive" delta={data.prior ? Number(data.totalIncome) - Number(data.prior.totalIncome) : null} />
        <SummaryTile label="Expenses" value={money(data.totalExpenses)} delta={data.prior ? Number(data.totalExpenses) - Number(data.prior.totalExpenses) : null} invert />
        <SummaryTile label="Net profit" value={signed(data.netProfit)} tone={net >= 0 ? 'positive' : 'warning'} hint={data.marginPercent === null ? undefined : `${data.marginPercent}% margin`} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <SectionHeader
            title={`Profit & loss · ${data.from} → ${data.to}`}
            description={data.prior ? 'Compared with the previous period of equal length.' : 'Income less expenses, straight from your ledger.'}
            action={
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]" />
                  Compare
                </label>
                <Button variant="outline" size="sm" onClick={() => onExport(rows, 'profit-and-loss')}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            }
          />
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <LineTable title="Income" lines={data.income} total={data.totalIncome} totalLabel="Total income" tone="income" />
          <LineTable title="Expenses" lines={data.expenses} total={data.totalExpenses} totalLabel="Total expenses" tone="expense" />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value, tone = 'neutral', delta, hint, invert }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'warning'; delta?: number | null; hint?: string; invert?: boolean }) {
  const good = delta === null || delta === undefined ? null : invert ? delta < 0 : delta > 0;
  return (
    <div className="rounded-panel border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1 font-mono text-xl font-semibold tabular-nums', tone === 'positive' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-foreground')}>
        {value}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {delta !== null && delta !== undefined && Number.isFinite(delta) ? (
          <span className={cn('inline-flex items-center gap-0.5', good ? 'text-success' : 'text-warning')}>
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {money(Math.abs(delta))} vs previous
          </span>
        ) : (
          <span>{hint ?? 'no comparison'}</span>
        )}
      </div>
    </div>
  );
}

function BalancePanel({ asOf, onExport }: { asOf: string; onExport: (rows: (string | number)[][], name: string) => void }) {
  const { data, isLoading, isError, refetch } = useBalanceSheet(asOf);
  if (isLoading) return <Skeleton className="h-96 w-full rounded-panel" />;
  if (isError || !data) {
    return (
      <Card><CardContent className="py-10"><p className="text-sm">The balance sheet could not be built.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Try again</Button></CardContent></Card>
    );
  }
  const rows: (string | number)[][] = [
    ['Balance sheet', `as of ${data.asOf}`],
    ['Assets', ...data.assets.map((line) => `${line.name}: ${line.amount}`)],
    ['Liabilities', ...data.liabilities.map((line) => `${line.name}: ${line.amount}`)],
    ['Equity', ...data.equity.map((line) => `${line.name}: ${line.amount}`)],
    ['Retained earnings', data.retainedEarnings],
    ['Total assets', data.totalAssets],
    ['Total liabilities and equity', data.totalLiabilitiesAndEquity],
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <SectionHeader
            title={`Balance sheet · ${data.asOf}`}
            description="What you own, what you owe, and what is left for you."
            action={
              <div className="flex items-center gap-2">
                <Badge variant={data.balanced ? 'secondary' : 'destructive'} className="text-[10px]">
                  {data.balanced ? 'balanced' : 'out of balance'}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => onExport(rows, 'balance-sheet')}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            }
          />
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <LineList title="Assets" lines={data.assets} total={data.totalAssets} />
          </div>
          <div className="space-y-4">
            <LineList title="Liabilities" lines={data.liabilities} total={data.totalLiabilities} />
            <LineList title="Equity" lines={data.equity} total={data.totalEquity} extra={{ label: 'Retained earnings', value: data.retainedEarnings }} total2={data.totalLiabilitiesAndEquity} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LineList({ title, lines, total, extra, total2 }: { title: string; lines: PnlLine[]; total: string; extra?: { label: string; value: string }; total2?: string }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="divide-y divide-border rounded-control border border-border">
        {lines.length === 0 && <li className="px-3 py-4 text-xs text-muted-foreground">Nothing here yet.</li>}
        {lines.map((line) => (
          <li key={line.accountId} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="truncate text-foreground">{line.name}</span>
            <span className="font-mono tabular-nums text-foreground">{money(line.amount)}</span>
          </li>
        ))}
        {extra && (
          <li className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-muted-foreground">{extra.label}</span>
            <span className="font-mono tabular-nums text-foreground">{signed(extra.value)}</span>
          </li>
        )}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-border-strong pt-2 text-sm font-semibold">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono tabular-nums text-foreground">{total2 ?? money(total)}</span>
      </div>
    </div>
  );
}

function CashPanel({ from, to, onExport }: { from: string; to: string; onExport: (rows: (string | number)[][], name: string) => void }) {
  const { data, isLoading, isError, refetch } = useCashFlow(from, to);
  if (isLoading) return <Skeleton className="h-96 w-full rounded-panel" />;
  if (isError || !data) {
    return <Card><CardContent className="py-10"><p className="text-sm">The cash flow statement could not be built.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Try again</Button></CardContent></Card>;
  }
  const rows: (string | number)[][] = [
    ['Cash flow', `${data.from} to ${data.to}`],
    ['Opening balance', data.opening],
    ['Operating', data.operating.net],
    ['Investing', data.investing.net],
    ['Financing', data.financing.net],
    ['Net change', data.net],
    ['Closing balance', data.closing],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Opening cash" value={money(data.opening)} />
        <SummaryTile label="Net change" value={signed(data.net)} tone={Number(data.net) >= 0 ? 'positive' : 'warning'} />
        <SummaryTile label="Closing cash" value={money(data.closing)} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <SectionHeader
            title={`Cash flow · ${data.from} → ${data.to}`}
            description="Only accounts holding liquid cash. Investments count as investing, borrowings as financing."
            action={<Button variant="outline" size="sm" onClick={() => onExport(rows, 'cash-flow')}><Download className="mr-1.5 h-3.5 w-3.5" /> CSV</Button>}
          />
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <CashSection title="Operating" section={data.operating} />
          <CashSection title="Investing" section={data.investing} />
          <CashSection title="Financing" section={data.financing} />
        </CardContent>
      </Card>
    </div>
  );
}

function CashSection({ title, section }: { title: string; section: { inflow: string; outflow: string; net: string; items: { name: string; amount: string }[] } }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="divide-y divide-border rounded-control border border-border">
        {section.items.length === 0 && <li className="px-3 py-4 text-xs text-muted-foreground">No movement.</li>}
        {section.items.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="truncate text-foreground">{item.name}</span>
            <span className={cn('font-mono tabular-nums', Number(item.amount) < 0 ? 'text-foreground' : 'text-success')}>{signed(item.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-border-strong pt-2 text-sm font-semibold">
        <span className="text-muted-foreground">Net</span>
        <span className={cn('font-mono tabular-nums', Number(section.net) < 0 ? 'text-warning' : 'text-success')}>{signed(section.net)}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        in {money(section.inflow)} · out {money(section.outflow)}
      </p>
    </div>
  );
}

function TrialPanel({ asOf, onExport }: { asOf: string; onExport: (rows: (string | number)[][], name: string) => void }) {
  const { data, isLoading, isError, refetch } = useTrialBalance(asOf);
  if (isLoading) return <Skeleton className="h-96 w-full rounded-panel" />;
  if (isError || !data) {
    return <Card><CardContent className="py-10"><p className="text-sm">The trial balance could not be built.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Try again</Button></CardContent></Card>;
  }
  const rows: (string | number)[][] = [['Account', 'Type', 'Debit', 'Credit'], ...data.rows.map((row) => [row.name, row.type, Number(row.debit), Number(row.credit)]), ['Total', '', Number(data.totalDebit), Number(data.totalCredit)]];
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title={`Trial balance · ${data.asOf}`}
          description="Every account at a glance. Debits and credits must agree."
          action={
            <div className="flex items-center gap-2">
              <Badge variant={data.balanced ? 'secondary' : 'destructive'} className="gap-1 text-[10px]">
                <Scale className="h-3 w-3" /> {data.balanced ? 'in balance' : 'does not balance'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => onExport(rows, 'trial-balance')}><Download className="mr-1.5 h-3.5 w-3.5" /> CSV</Button>
            </div>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-control border border-border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-3 py-2 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((row) => (
                <tr key={row.accountId}>
                  <td className="px-3 py-2 text-foreground">{row.name}</td>
                  <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{row.type}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{Number(row.debit) ? money(row.debit) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{Number(row.credit) ? money(row.credit) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border-strong bg-surface/60 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{money(data.totalDebit)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{money(data.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
