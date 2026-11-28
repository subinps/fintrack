import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Info, Landmark, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTaxSummary, useUpdateTaxProfile } from '../hooks/useFinance';

const money = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function TaxTab() {
  const { data, isLoading, isError, refetch } = useTaxSummary();
  const update = useUpdateTaxProfile();
  const [regime, setRegime] = useState('new');
  const [startMonth, setStartMonth] = useState('4');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<{ label: string; tag: string; limit: string }[]>([]);

  useEffect(() => {
    if (!data) return;
    setRegime(data.profile.regime);
    setStartMonth(String(data.profile.fiscalYearStartMonth));
    setNotes(data.profile.notes ?? '');
    setRows(data.profile.deductions.map((deduction) => ({ label: deduction.label, tag: deduction.tag, limit: deduction.limitPaise })));
  }, [data]);

  const save = async () => {
    try {
      await update.mutateAsync({
        regime,
        fiscalYearStartMonth: Number(startMonth),
        notes: notes.trim() ? notes.trim() : null,
        deductions: rows
          .filter((row) => row.label.trim() && row.tag.trim())
          .map((row) => ({ label: row.label.trim(), tag: row.tag.trim().toLowerCase(), limitPaise: row.limit.trim() || '0' })),
      });
      toast.success('Tax settings saved.');
    } catch {
      toast.error('Could not save the tax settings.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-panel" />
        <Skeleton className="h-72 w-full rounded-panel" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-2 py-10">
          <ReceiptText className="h-5 w-5 text-danger" />
          <p className="text-sm font-medium">The tax summary could not be built.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const taxable = Number(data.estimatedTaxableIncome);
  const tax = Number(data.estimatedTax);
  const maxSlice = Math.max(...data.advanceTax.map((row) => Number(row.amount)), 1);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Tax workspace</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Tax</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {data.fiscalYear.label} · {day(data.fiscalYear.from)} → {day(data.fiscalYear.to)}. Income, deductions and the advance tax you should set aside — all estimated from your ledger.
            </p>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-[0.12em]">
            <Info className="h-3 w-3" /> estimate
          </Badge>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Income this year" value={money(data.totalIncome)} hint={`${data.income.length} income sources`} />
        <Tile label="Estimated taxable" value={money(taxable)} hint={`after ${money(data.standardDeduction)} standard deduction`} />
        <Tile label="Estimated tax" value={money(tax)} hint={data.effectiveRatePercent === null ? 'no income yet' : `${data.effectiveRatePercent}% effective`} tone="warning" />
        <Tile label="Capital gains (est.)" value={money(data.capitalGains.estimatedGain)} hint="sales minus average cost" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Advance tax schedule</CardTitle>
            <CardDescription>Set this much aside by each date so the year never surprises you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.advanceTax.map((row) => {
              const past = new Date(`${row.due}T00:00:00Z`).getTime() < Date.now();
              return (
                <div key={row.due} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <CalendarClock className={cn('h-3.5 w-3.5', past ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
                      {row.label}
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{day(row.due)}</span>
                    </span>
                    <span className="font-mono tabular-nums text-foreground">{money(row.amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', past ? 'bg-muted-foreground/50' : 'bg-primary')}
                      style={{ width: `${Math.min(100, (Number(row.amount) / maxSlice) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Cess included. {data.disclaimer}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deductions</CardTitle>
            <CardDescription>Tag an expense and it counts here up to its limit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.deductions.length === 0 && (
              <p className="rounded-control border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No deductions tracked yet. Add one below — for example 80C with a ₹1,50,000 limit tagged “80c”.
              </p>
            )}
            {data.deductions.map((deduction) => {
              const used = Number(deduction.used);
              const limit = Number(deduction.limit);
              const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
              return (
                <div key={deduction.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{deduction.label}</span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {money(deduction.used)} / {limit > 0 ? money(deduction.limit) : 'no limit'}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className={cn('h-full rounded-full', deduction.over ? 'bg-warning' : 'bg-success')} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estimates and settings</CardTitle>
          <CardDescription>Change the regime or fiscal year; the numbers above follow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="tax-regime" className="mb-1 block text-[11px] text-muted-foreground">Regime</Label>
              <Select value={regime} onValueChange={setRegime}>
                <SelectTrigger id="tax-regime" className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New regime</SelectItem>
                  <SelectItem value="old">Old regime (with deductions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tax-start" className="mb-1 block text-[11px] text-muted-foreground">Fiscal year starts</Label>
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger id="tax-start" className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tax-notes" className="mb-1 block text-[11px] text-muted-foreground">Notes for your CA</Label>
              <Input id="tax-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything worth remembering" className="h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="eyebrow">Deduction tags</p>
            {rows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
                <Input
                  value={row.label}
                  placeholder="Label (80C)"
                  onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))}
                  className="h-10"
                  aria-label={`Deduction label ${index + 1}`}
                />
                <Input
                  value={row.tag}
                  placeholder="tag on expenses"
                  onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, tag: event.target.value } : item)))}
                  className="h-10 font-mono text-sm"
                  aria-label={`Deduction tag ${index + 1}`}
                />
                <Input
                  value={row.limit}
                  placeholder="150000"
                  inputMode="decimal"
                  onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, limit: event.target.value } : item)))}
                  className="h-10 font-mono text-sm"
                  aria-label={`Deduction limit ${index + 1}`}
                />
                <Button variant="ghost" size="icon" aria-label={`Remove deduction ${index + 1}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setRows([...rows, { label: '', tag: '', limit: '' }])}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add deduction
              </Button>
              <Button size="sm" onClick={save} disabled={update.isPending}>
                <Landmark className="mr-1.5 h-3.5 w-3.5" /> Save settings
              </Button>
            </div>
          </div>

          <div className="rounded-control border border-border bg-surface p-3 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">Capital gains estimate</p>
            <p className="mt-0.5">
              Proceeds {money(data.capitalGains.proceeds)} − estimated cost {money(data.capitalGains.estimatedCost)} ={' '}
              {money(data.capitalGains.estimatedGain)}. {data.capitalGains.note}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint: string; tone?: 'neutral' | 'warning' }) {
  return (
    <div className="rounded-panel border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1 font-mono text-xl font-semibold tabular-nums', tone === 'warning' ? 'text-warning' : 'text-foreground')}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
