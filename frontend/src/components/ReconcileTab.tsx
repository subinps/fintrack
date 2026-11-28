import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  ArrowDownToLine,
  BadgeCheck,
  CircleAlert,
  FileSpreadsheet,
  Filter,
  Loader2,
  Plus,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGetAccounts } from '../hooks/useQueries';
import {
  useCompleteRecon,
  useCreateImportRule,
  useDeleteImportRule,
  useImportCommit,
  useImportPreview,
  useImportRules,
  useReconLines,
  useReconSummary,
  useUndoRecon,
  type ImportPreview,
} from '../hooks/useFinance';
import { PageGuide } from '@/components/system/PageGuide';
import { PAGE_HELP } from '@/lib/page-help';

const money = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const signed = (value: string | number | null | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n) || n === 0) return money(0);
  return `${n < 0 ? '−' : '+'}${money(n)}`;
};

const today = () => new Date().toISOString().slice(0, 10);

export function ReconcileTab() {
  const { data: accounts } = useGetAccounts();
  const [tab, setTab] = useState('reconcile');
  const assetAccounts = useMemo(
    () => (accounts ?? []).filter((account) => account.type === 'ASSET' && !account.units),
    [accounts]
  );
  const [accountId, setAccountId] = useState<number | null>(null);
  const currentAccount = assetAccounts.find((account) => account.id === accountId) ?? assetAccounts[0] ?? null;
  const effectiveAccountId = currentAccount?.id ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Statement desk</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Reconcile</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Match the bank’s version of events against your ledger, import statements from any bank, and teach FinTrack how to categorise what it sees.
            </p>
          </div>
          {assetAccounts.length > 0 && (
            <div className="w-full sm:w-64">
              <Label htmlFor="recon-account" className="mb-1.5 block text-xs text-muted-foreground">
                Account
              </Label>
              <Select value={String(effectiveAccountId ?? '')} onValueChange={(value) => setAccountId(Number(value))}>
                <SelectTrigger id="recon-account" aria-label="Reconciliation account">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      <PageGuide {...PAGE_HELP.reconcile} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
          <TabsTrigger value="import">Import statement</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="reconcile" className="mt-4">
          {effectiveAccountId === null ? (
            <EmptyReconcile />
          ) : (
            <ReconcilePanel accountId={effectiveAccountId} accountName={currentAccount?.name ?? ''} />
          )}
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          {effectiveAccountId === null ? (
            <EmptyReconcile />
          ) : (
            <ImportWizard accountId={effectiveAccountId} accounts={assetAccounts} onDone={() => setTab('reconcile')} />
          )}
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <RulesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyReconcile() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-start gap-2 py-10">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <BadgeCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">Add a bank account first</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Reconciliation compares one bank account against a statement. Create a bank or cash account, then come back with
          your statement file.
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.assign('/?tab=accounts')}>
          Add a bank account
        </Button>
      </CardContent>
    </Card>
  );
}

function ReconcilePanel({ accountId, accountName }: { accountId: number; accountName: string }) {
  const [status, setStatus] = useState<'all' | 'uncleared' | 'cleared'>('uncleared');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statementBalance, setStatementBalance] = useState('');
  const [undoOpen, setUndoOpen] = useState(false);
  const { data: lines, isLoading } = useReconLines(accountId, status);
  const { data: summary, isLoading: summaryLoading } = useReconSummary(accountId);
  const complete = useCompleteRecon();
  const undo = useUndoRecon();

  const cleared = Number(summary?.clearedBalance ?? 0);
  const statement = Number(statementBalance || 0);
  const difference = statementBalance.trim() === '' ? null : cleared - statement;

  const toggle = (splitId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(splitId)) next.delete(splitId);
      else next.add(splitId);
      return next;
    });
  };

  const allVisible = (lines ?? []).map((line) => line.splitId);
  const allSelected = allVisible.length > 0 && allVisible.every((id) => selected.has(id));

  const handleComplete = async () => {
    try {
      const result = await complete.mutateAsync({
        accountId,
        splitIds: [...selected],
        statementBalance: statementBalance.trim() || undefined,
      });
      setSelected(new Set());
      if (typeof result.balanced === 'boolean') {
        toast.success(
          result.balanced
            ? `Reconciled ${result.reconciled} ${result.reconciled === 1 ? 'line' : 'lines'} — your balance matches the statement.`
            : `Reconciled ${result.reconciled} lines. Still ${money(result.difference)} off the statement.`
        );
      } else {
        toast.success(`Reconciled ${result.reconciled} ${result.reconciled === 1 ? 'line' : 'lines'}.`);
      }
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not reconcile those lines.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Ledger balance" value={summaryLoading ? null : money(summary?.ledgerBalance)} hint={`${summary?.clearedCount ?? 0} cleared`} />
        <Stat label="Cleared balance" value={summaryLoading ? null : money(summary?.clearedBalance)} hint="matches the bank so far" />
        <Stat
          label="Statement difference"
          value={summaryLoading ? null : difference === null ? '—' : money(difference)}
          hint={difference === null ? 'enter the closing balance' : difference === 0 ? 'balanced' : 'adjust or find the gap'}
          tone={difference === null ? 'neutral' : difference === 0 ? 'positive' : 'warning'}
        />
      </div>

      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Uncleared lines — {accountName}</CardTitle>
              <CardDescription>Tick the lines that appear on your statement, then enter the closing balance.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Filter lines">
                  <Filter className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncleared">Uncleared</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="all">All lines</SelectItem>
                </SelectContent>
              </Select>
              {status === 'cleared' && (
                <Button variant="ghost" size="sm" onClick={() => setUndoOpen(true)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Undo
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface px-3 py-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(allVisible))}
                aria-label="Select all visible lines"
              />
              Select all
            </label>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {selected.size} selected
            </span>
            <div className="ml-auto flex flex-1 items-center gap-2 sm:flex-none">
              <Label htmlFor="statement-balance" className="whitespace-nowrap text-xs text-muted-foreground">
                Statement closing
              </Label>
              <Input
                id="statement-balance"
                inputMode="decimal"
                placeholder="e.g. 48250.75"
                value={statementBalance}
                onChange={(event) => setStatementBalance(event.target.value)}
                className="h-9 w-36 font-mono text-sm"
              />
              <Button size="sm" onClick={handleComplete} disabled={selected.size === 0 || complete.isPending}>
                {complete.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />}
                Reconcile {selected.size > 0 ? selected.size : ''}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (lines?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-foreground">
                {status === 'cleared' ? 'Nothing cleared yet' : 'Every line is cleared'}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {status === 'cleared'
                  ? 'Tick lines on the uncleared view and reconcile them to build history.'
                  : 'Import a statement to pull in anything the bank has that your ledger does not.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-control border border-border">
              {lines?.map((line) => (
                <li key={line.splitId} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-border accent-[hsl(var(--primary))]"
                    checked={selected.has(line.splitId)}
                    onChange={() => toggle(line.splitId)}
                    aria-label={`Select ${line.description}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{line.description}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {line.date} · {line.source.toLowerCase()}
                      {line.tags.length > 0 ? ` · ${line.tags.join(', ')}` : ''}
                    </p>
                  </div>
                  {line.reconciledAt && <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">cleared</Badge>}
                  <span className={cn('shrink-0 font-mono text-sm tabular-nums', Number(line.amount) < 0 ? 'text-foreground' : 'text-success')}>
                    {signed(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={undoOpen} onOpenChange={setUndoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the reconciliation marks?</AlertDialogTitle>
            <AlertDialogDescription>
              This un-ticks every cleared line on {accountName}. Your transactions are untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const clearedIds = (lines ?? []).filter((line) => line.reconciledAt).map((line) => line.splitId);
                if (clearedIds.length === 0) return;
                await undo.mutateAsync({ accountId, splitIds: clearedIds });
                toast.success('Cleared marks removed.');
              }}
            >
              Undo reconciliation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, hint, tone = 'neutral' }: { label: string; value: string | null; hint: string; tone?: 'neutral' | 'positive' | 'warning' }) {
  return (
    <div className="rounded-panel border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      {value === null ? <Skeleton className="mt-2 h-7 w-28" /> : (
        <p
          className={cn(
            'mt-1 font-mono text-xl font-semibold tabular-nums',
            tone === 'positive' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-foreground'
          )}
        >
          {value}
        </p>
      )}
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ImportWizard({ accountId, accounts, onDone }: { accountId: number; accounts: { id: number; name: string }[]; onDone: () => void }) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'statement' | 'ledger'>('statement');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const previewMutation = useImportPreview();
  const commit = useImportCommit();
  const [result, setResult] = useState<{ posted: number; skipped: number; reconciled: number; failed: { index: number; error: string }[] } | null>(null);

  const categoryAccounts = accounts;

  const handlePreview = async () => {
    if (!file) return;
    try {
      const data = await previewMutation.mutateAsync({ file, accountId, mode });
      setPreview(data);
      if (data.rows.length === 0) toast.error('No rows found in that file.');
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not read that file.');
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    const rows = preview.rows
      .filter((row) => !row.error && !(mode === 'statement' && row.duplicate))
      .map((row) => ({
        date: row.date,
        description: row.description,
        amount: row.amount,
        categoryAccountId: row.rule?.accountId ?? null,
        matchSplitId: row.match?.splitId ?? null,
        externalId: row.externalId ?? null,
      }));
    try {
      const data = await commit.mutateAsync({ accountId, mode, skipDuplicates: true, rows });
      setResult(data);
      toast.success(`Posted ${data.posted} entries${data.reconciled ? `, matched ${data.reconciled}` : ''}.`);
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Import failed.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Bring in a statement or ledger file</CardTitle>
          <CardDescription>CSV, Excel and OFX/QFX from any bank. FinTrack reads the columns, flags duplicates and suggests a category from your rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="import-file" className="mb-1.5 block text-xs text-muted-foreground">
                File
              </Label>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-control border border-dashed border-border-strong bg-surface px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {file ? file.name : 'Choose a CSV, Excel or OFX file'}
              </button>
              <input
                ref={fileInput}
                id="import-file"
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,.ofx,.qfx"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setResult(null);
                }}
              />
            </div>
            <div className="flex gap-2">
              <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                <SelectTrigger className="h-11 w-[11rem]" aria-label="Import mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="statement">Bank statement</SelectItem>
                  <SelectItem value="ledger">Ledger export</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handlePreview} disabled={!file || previewMutation.isPending} className="h-11">
                {previewMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-1.5 h-4 w-4" />}
                Preview
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Statement mode matches rows to lines you already posted and posts only what is new. Ledger mode posts every row as a new entry.
          </p>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Preview ({preview.rows.length} rows)</CardTitle>
                <CardDescription>
                  {preview.summary.duplicates} already in your ledger · {preview.summary.matched} matched to existing lines ·{' '}
                  {preview.summary.invalid} unreadable · net {signed(preview.summary.sum)}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPreview(null); setResult(null); }}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                </Button>
                <Button size="sm" onClick={handleCommit} disabled={commit.isPending || preview.rows.length === 0}>
                  {commit.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />}
                  Import
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[26rem] overflow-auto rounded-control border border-border">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Category / match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.slice(0, 200).map((row) => (
                    <tr key={row.index} className={cn(row.error && 'bg-danger-soft/40', row.duplicate && !row.error && 'bg-warning-soft/30')}>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">{row.date || '—'}</td>
                      <td className="max-w-[18rem] truncate px-3 py-2 text-foreground">{row.description}</td>
                      <td className={cn('whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums', Number(row.amount) < 0 ? 'text-foreground' : 'text-success')}>
                        {row.amount ? signed(row.amount) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-danger"><CircleAlert className="h-3 w-3" /> {row.error}</span>
                        ) : row.duplicate ? (
                          <Badge variant="outline" className="text-[10px]">already posted</Badge>
                        ) : row.match ? (
                          <span className="text-[11px] text-muted-foreground">
                            matches “{row.match.description}” · {row.match.score}%
                          </span>
                        ) : row.rule ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" /> {row.rule.accountName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Uncategorised</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {mode === 'statement'
                ? `Matched rows only get ticked off; ${categoryAccounts.length} accounts available as categories. Add rules to categorise the rest automatically.`
                : 'Every valid row posts as its own double entry. Unmatched rows land in an “Uncategorised” account you can re-file later.'}
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-success/30 bg-success-soft/20">
          <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
            <BadgeCheck className="h-5 w-5 text-success" aria-hidden="true" />
            <span className="font-medium text-foreground">{result.posted} posted</span>
            <span className="text-muted-foreground">{result.reconciled} matched</span>
            <span className="text-muted-foreground">{result.skipped} skipped as duplicates</span>
            {result.failed.length > 0 && <span className="text-danger">{result.failed.length} failed</span>}
            <Button variant="outline" size="sm" className="ml-auto" onClick={onDone}>
              Back to reconcile
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RulesPanel() {
  const { data: rules, isLoading } = useImportRules();
  const { data: accounts } = useGetAccounts();
  const categories = (accounts ?? []).filter((account) => account.type === 'EXPENSE' || account.type === 'INCOME' || account.type === 'ASSET');
  const create = useCreateImportRule();
  const remove = useDeleteImportRule();
  const [form, setForm] = useState({ name: '', pattern: '', matchType: 'CONTAINS', accountId: '' });

  const submit = async () => {
    if (!form.name.trim() || !form.pattern.trim() || !form.accountId) {
      toast.error('Name the rule, add a pattern and pick a category.');
      return;
    }
    try {
      await create.mutateAsync({ name: form.name, pattern: form.pattern, matchType: form.matchType, accountId: Number(form.accountId), priority: (rules?.length ?? 0) * 10 + 10 });
      setForm({ name: '', pattern: '', matchType: 'CONTAINS', accountId: '' });
      toast.success('Rule saved. New imports will use it.');
    } catch {
      toast.error('Could not save that rule.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Categorisation rules</CardTitle>
          <CardDescription>When a description matches, the row is filed to the category you choose. Earlier rules win.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_9rem_11rem_auto]">
            <div>
              <Label htmlFor="rule-name" className="mb-1 block text-[11px] text-muted-foreground">Rule name</Label>
              <Input id="rule-name" value={form.name} placeholder="Coffee runs" onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-10" />
            </div>
            <div>
              <Label htmlFor="rule-pattern" className="mb-1 block text-[11px] text-muted-foreground">Matches text</Label>
              <Input id="rule-pattern" value={form.pattern} placeholder="STARBUCKS" onChange={(event) => setForm({ ...form, pattern: event.target.value })} className="h-10 font-mono text-sm" />
            </div>
            <div>
              <Label htmlFor="rule-match" className="mb-1 block text-[11px] text-muted-foreground">How</Label>
              <Select value={form.matchType} onValueChange={(value) => setForm({ ...form, matchType: value })}>
                <SelectTrigger id="rule-match" className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTAINS">Contains</SelectItem>
                  <SelectItem value="EQUALS">Equals</SelectItem>
                  <SelectItem value="REGEX">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-account" className="mb-1 block text-[11px] text-muted-foreground">Category</Label>
              <Select value={form.accountId} onValueChange={(value) => setForm({ ...form, accountId: value })}>
                <SelectTrigger id="rule-account" className="h-10"><SelectValue placeholder="Pick one" /></SelectTrigger>
                <SelectContent>
                  {categories.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="h-10 w-full" onClick={submit} disabled={create.isPending}>
                <Plus className="mr-1.5 h-4 w-4" /> Add rule
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (rules?.length ?? 0) === 0 ? (
            <div className="rounded-control border border-dashed border-border px-4 py-8 text-center">
              <FileSpreadsheet className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-foreground">No rules yet</p>
              <p className="text-xs text-muted-foreground">Add one above and every future import files itself.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-control border border-border">
              {rules?.map((rule) => (
                <li key={rule.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      {rule.matchType.toLowerCase()} “{rule.pattern}” → {rule.account.name}
                    </p>
                  </div>
                  <Badge variant={rule.active ? 'secondary' : 'outline'} className="hidden text-[10px] sm:inline-flex">
                    {rule.active ? 'active' : 'paused'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete rule ${rule.name}`}
                    onClick={async () => {
                      await remove.mutateAsync(rule.id);
                      toast.success('Rule deleted.');
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Today is read at import time; rules never rewrite entries you already posted.
      </p>
      <span className="sr-only">{today()}</span>
    </div>
  );
}
