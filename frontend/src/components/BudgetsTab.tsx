import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  Flag,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetAccounts, type Account } from '../hooks/useQueries';
import {
  useAutoContribute,
  useBudgetAlerts,
  useBudgetFromTemplate,
  useBudgetItems,
  useBudgetSummary,
  useBudgetTemplates,
  useBudgets,
  useContributeToGoal,
  useCreateBudget,
  useCreateGoal,
  useDeleteBudget,
  useDeleteGoal,
  useGoals,
  useSafeToSpend,
  useUpdateBudget,
  type BudgetItemPayload,
  type BudgetItemStatus,
  type BudgetPeriod,
  type BudgetStatus,
  type BudgetType,
  type Goal,
  type Pace,
} from '../hooks/useBudgets';
import { formatINR } from '../lib/finance';
import { cn } from '@/lib/utils';
import { ErrorState, SectionHeading, SkeletonBlock } from './overview/primitives';

const periodLabel: Record<BudgetPeriod, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
};

const typeLabel: Record<BudgetType, string> = {
  FIXED: 'Fixed',
  PERCENT_INCOME: '% of income',
  ZERO_BASED: 'Zero-based',
  ENVELOPE: 'Envelope',
};

const paceCopy: Record<Pace, { label: string; cls: string }> = {
  ON_TRACK: { label: 'On track', cls: 'text-success border-success/30 bg-success/10' },
  WATCH: { label: 'Watch', cls: 'text-warning border-warning/30 bg-warning/10' },
  OVER: { label: 'Over', cls: 'text-destructive border-destructive/30 bg-destructive/10' },
};

const rupees = (paise: string | null | undefined) => formatINR(Number(paise ?? 0));
const rupeesInput = (paise: string | null | undefined) => {
  const value = Number(paise ?? 0) / 100;
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0';
};
const toPaise = (rupees: string) => {
  const value = Number(rupees.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(value) ? String(Math.max(0, Math.round(value * 100))) : '0';
};
const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

function PaceChip({ pace, className }: { pace: Pace; className?: string }) {
  const copy = paceCopy[pace];
  return (
    <span className={cn('mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]', copy.cls, className)}>
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
      {copy.label}
    </span>
  );
}

function ProgressBar({ percent, pace, label }: { percent: number; pace: Pace; label: string }) {
  const width = Math.min(100, Math.max(percent, percent > 0 ? 3 : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          pace === 'OVER' ? 'bg-destructive' : pace === 'WATCH' ? 'bg-warning' : 'bg-primary'
        )}
        style={{ width: `${width}%` }}
      />
      <span className="absolute inset-y-0 left-[50%] w-px bg-background/60" aria-hidden="true" />
      <span className="absolute inset-y-0 left-[80%] w-px bg-background/60" aria-hidden="true" />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          'mono mt-1.5 text-[20px] font-medium tabular-nums tracking-[-0.02em]',
          tone === 'positive' ? 'text-success' : tone === 'negative' ? 'text-destructive' : 'text-foreground'
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CategoryRow({ item, budgetType, depth = 0 }: { item: BudgetItemStatus; budgetType: BudgetType; depth?: number }) {
  return (
    <>
      <div className="flex items-center gap-3 py-2" style={{ paddingLeft: depth * 14 }}>
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            item.pace === 'OVER' ? 'bg-destructive' : item.pace === 'WATCH' ? 'bg-warning' : 'bg-primary/70'
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{item.name}</span>
        <span className="mono shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {rupees(item.spentPaise)} <span className="text-muted-foreground/60">/</span>{' '}
          {budgetType === 'PERCENT_INCOME' && item.percent != null ? `${item.percent}% · ` : ''}
          {rupees(item.limitPaise)}
        </span>
        <span
          className={cn(
            'mono w-10 shrink-0 text-right text-[11px] tabular-nums',
            item.pace === 'OVER' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {Math.round(item.percentUsed)}%
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" style={{ marginLeft: 18 + depth * 14 }}>
        <div
          className={cn(
            'h-full rounded-full',
            item.pace === 'OVER' ? 'bg-destructive' : item.pace === 'WATCH' ? 'bg-warning' : 'bg-primary/70'
          )}
          style={{ width: `${Math.min(100, Math.max(item.percentUsed, item.spentPaise !== '0' ? 2 : 0))}%` }}
        />
      </div>
      {item.children.map((child) => (
        <CategoryRow key={child.id} item={child} budgetType={budgetType} depth={depth + 1} />
      ))}
    </>
  );
}

function BudgetCard({ budget, onEdit }: { budget: BudgetStatus; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const visible = open ? budget.items : budget.items.slice(0, 4);
  const over = Number(budget.totalRemainingPaise) < 0;

  return (
    <article className="panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-foreground">{budget.name}</h3>
          <p className="mono mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {periodLabel[budget.period]} · {typeLabel[budget.type]} · ends {dateLabel(budget.periodEnd)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PaceChip pace={budget.pace} />
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${budget.name}`} onClick={onEdit}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <span className="mono text-[26px] font-medium tabular-nums tracking-[-0.03em] text-foreground">
              {rupees(budget.totalSpentPaise)}
            </span>
            <span className="mono ml-1.5 text-[12px] text-muted-foreground">of {rupees(budget.totalLimitPaise)}</span>
          </div>
          <span className="mono text-[11px] tabular-nums text-muted-foreground">{Math.round(budget.percentUsed)}%</span>
        </div>
        <ProgressBar percent={budget.percentUsed} pace={budget.pace} label={`${budget.name} budget used`} />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className={cn('mono tabular-nums', over ? 'text-destructive' : 'text-foreground')}>
            {over ? `${rupees(String(-Number(budget.totalRemainingPaise)))} over` : `${rupees(budget.totalRemainingPaise)} left`}
          </span>
          {Number(budget.totalRemainingPaise) > 0 && budget.daysLeft > 0 ? (
            <span>
              · {rupees(String(Math.floor(Number(budget.totalRemainingPaise) / Math.max(1, budget.daysLeft))))}/day for{' '}
              {budget.daysLeft} {budget.daysLeft === 1 ? 'day' : 'days'}
            </span>
          ) : null}
          {Number(budget.rolloverPaise) > 0 ? (
            <span className="mono rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary-strong">
              +{rupees(budget.rolloverPaise)} rolled over
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 divide-y divide-border/60 border-t border-border/60 pt-1">
        {visible.map((item) => (
          <CategoryRow key={item.id} item={item} budgetType={budget.type} />
        ))}
      </div>

      {budget.items.length > 4 ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-2 flex items-center gap-1 self-start rounded-sm text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          {open ? 'Show less' : `${budget.items.length - 4} more categories`}
        </button>
      ) : null}

      {Number(budget.projectedOverspendPaise) > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-sm bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
          <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          At this pace you finish {rupees(budget.projectedOverspendPaise)} over.
        </p>
      ) : null}
      {budget.type === 'ZERO_BASED' && budget.unallocatedPaise != null ? (
        <p className={cn('mono mt-3 text-[10px] uppercase tracking-[0.1em]', Number(budget.unallocatedPaise) < 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {Number(budget.unallocatedPaise) >= 0
            ? `${rupees(budget.unallocatedPaise)} still unassigned`
            : `${rupees(String(-Number(budget.unallocatedPaise)))} over income`}
        </p>
      ) : null}
    </article>
  );
}

function GoalCard({
  goal,
  onContribute,
}: {
  goal: Goal;
  onContribute: (goal: Goal) => void;
}) {
  const percent = Math.max(0, Math.min(100, goal.percentComplete));
  const circumference = 2 * Math.PI * 26;
  return (
    <article className="panel flex items-center gap-4 p-4">
      <div className="relative h-[68px] w-[68px] shrink-0">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke={goal.status === 'DONE' ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <span className="mono absolute inset-0 flex items-center justify-center text-[12px] font-medium tabular-nums text-foreground">
          {Math.round(percent)}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[13.5px] font-semibold text-foreground">{goal.name}</h3>
          {goal.recurringRuleId ? (
            <span className="mono rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-primary-strong">
              auto
            </span>
          ) : null}
        </div>
        <p className="mono mt-1 text-[11px] tabular-nums text-muted-foreground">
          {rupees(goal.progressPaise)} <span className="opacity-60">of</span> {rupees(goal.targetAmount)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {goal.status === 'DONE'
            ? 'Fully funded'
            : goal.targetDate
              ? `${rupees(goal.requiredMonthlyPaise)}/mo · ${dateLabel(goal.targetDate)}`
              : `${rupees(goal.remainingPaise)} to go`}
          {goal.linkedAccountName ? ` · ${goal.linkedAccountName}` : ''}
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => onContribute(goal)} aria-label={`Contribute to ${goal.name}`}>
        <Coins className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Add
      </Button>
    </article>
  );
}

type ItemDraft = { key: string; id?: string; name: string; accountId: string; amount: string; percent: string; alertAt: number[] };

let draftKey = 0;
const newDraft = (overrides: Partial<ItemDraft> = {}): ItemDraft => ({
  key: `item-${draftKey += 1}`,
  name: '',
  accountId: '',
  amount: '',
  percent: '',
  alertAt: [50, 80, 100],
  ...overrides,
});

function BudgetEditor({
  budget,
  accounts,
  budgets,
  presetAccountId,
  onClose,
  onDelete,
}: {
  budget: BudgetStatus | null;
  accounts: Account[];
  budgets: BudgetStatus[];
  presetAccountId?: number | null;
  onClose: () => void;
  onDelete?: () => Promise<void>;
}) {
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const { add, update, remove } = useBudgetItems(budget?.id ?? '');
  const [name, setName] = useState(budget?.name ?? '');
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? 'MONTHLY');
  const [type, setType] = useState<BudgetType>(budget?.type ?? 'FIXED');
  const [startDate, setStartDate] = useState((budget?.startDate ?? new Date().toISOString()).slice(0, 10));
  const [endDate, setEndDate] = useState(budget?.endDate ? budget.endDate.slice(0, 10) : '');
  const [rollover, setRollover] = useState(budget?.rollover ?? false);
  const [cap, setCap] = useState(budget?.rolloverCapPaise ? rupeesInput(budget.rolloverCapPaise) : '');
  const [items, setItems] = useState<ItemDraft[]>(
    budget
      ? budget.items.flatMap((item) => [
          {
            key: item.id,
            id: item.id,
            name: item.name,
            accountId: item.accountId ? String(item.accountId) : '',
            amount: rupeesInput(item.amountPaise),
            percent: item.percent != null ? String(item.percent) : '',
            alertAt: item.alertAt,
          },
          ...item.children.map((child) => ({
            key: child.id,
            id: child.id,
            name: child.name,
            accountId: child.accountId ? String(child.accountId) : '',
            amount: rupeesInput(child.amountPaise),
            percent: child.percent != null ? String(child.percent) : '',
            alertAt: child.alertAt,
          })),
        ])
      : [newDraft({ accountId: presetAccountId ? String(presetAccountId) : '' })]
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [copyFrom, setCopyFrom] = useState('');

  const expenseAccounts = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'EXPENSE' ? -1 : b.type === 'EXPENSE' ? 1 : a.name.localeCompare(b.name);
    });
    return sorted;
  }, [accounts]);

  const busy = createBudget.isPending || updateBudget.isPending || add.isPending || update.isPending || remove.isPending || Boolean(copyFrom);

  const save = async () => {
    if (!name.trim()) {
      toast.error('Give the budget a name');
      return;
    }
    const draftFor = (item: ItemDraft): BudgetItemPayload => ({
      name: item.name.trim() || null,
      accountId: item.accountId ? Number(item.accountId) : null,
      amountPaise: type === 'PERCENT_INCOME' ? '0' : toPaise(item.amount),
      percent: type === 'PERCENT_INCOME' && item.percent ? Number(item.percent) : null,
      alertAt: item.alertAt,
    });
    const validItems = items.filter((item) => item.accountId || item.name.trim());

    if (!budget) {
      await createBudget.mutateAsync({
        name: name.trim(),
        period,
        type,
        startDate,
        endDate: period === 'CUSTOM' ? endDate || null : null,
        rollover,
        rolloverCapPaise: rollover && cap ? toPaise(cap) : null,
        items: validItems.map(draftFor),
      });
      toast.success('Budget created');
      onClose();
      return;
    }

    await updateBudget.mutateAsync({
      id: budget.id,
      name: name.trim(),
      period,
      type,
      startDate,
      endDate: period === 'CUSTOM' ? endDate || null : null,
      rollover,
      rolloverCapPaise: rollover && cap ? toPaise(cap) : null,
    });

    for (const id of removed) await remove.mutateAsync(id);
    for (const item of validItems) {
      const draft = draftFor(item);
      if (item.id) await update.mutateAsync({ itemId: item.id, ...draft });
      else await add.mutateAsync(draft);
    }
    toast.success('Budget updated');
    onClose();
  };

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message ?? fallback);
    }
  };

  return (
    <DialogContent className="max-h-[92vh] w-[min(760px,95vw)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          {budget ? 'Edit budget' : 'New budget'}
        </DialogTitle>
        <DialogDescription>
          Set a limit per category and FinTrack tracks spending from the ledger, warns before you overspend and carries unused money forward.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="budget-name">Name</Label>
          <Input id="budget-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Monthly essentials" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget-period">Period</Label>
          <Select value={period} onValueChange={(value) => setPeriod(value as BudgetPeriod)}>
            <SelectTrigger id="budget-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget-type">Method</Label>
          <Select value={type} onValueChange={(value) => setType(value as BudgetType)}>
            <SelectTrigger id="budget-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget-start">Starts</Label>
          <Input id="budget-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </div>
        {period === 'CUSTOM' ? (
          <div className="space-y-2">
            <Label htmlFor="budget-end">Ends</Label>
            <Input id="budget-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-2.5 rounded-sm border border-border bg-surface/60 px-3 py-2.5 text-[12px] text-foreground">
        <input
          type="checkbox"
          checked={rollover}
          onChange={(event) => setRollover(event.target.checked)}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        Carry unspent money into the next period
        {rollover ? (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">cap ₹</span>
            <Input
              aria-label="Rollover cap in rupees"
              className="h-8 w-24 text-right"
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              placeholder="No cap"
            />
          </span>
        ) : null}
      </label>

      {!budget && budgets.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="budget-copy">Copy categories from</Label>
            <Select value={copyFrom} onValueChange={(value) => {
              setCopyFrom(value);
              const source = budgets.find((entry) => entry.id === value);
              if (!source) return;
              setItems(
                source.items.map((item) => ({
                  key: `copy-${item.id}`,
                  name: item.name,
                  accountId: item.accountId ? String(item.accountId) : '',
                  amount: rupeesInput(item.amountPaise),
                  percent: item.percent != null ? String(item.percent) : '',
                  alertAt: item.alertAt,
                }))
              );
              setType(source.type);
              setPeriod(source.period);
            }}>
              <SelectTrigger id="budget-copy">
                <SelectValue placeholder="Start blank" />
              </SelectTrigger>
              <SelectContent>
                {budgets.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Categories</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((rows) => [...rows, newDraft()])}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Category
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.key} className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface/40 p-2.5">
              <div className="min-w-[140px] flex-1">
              <Select
                value={item.accountId || 'none'}
                onValueChange={(value) =>
                  setItems((rows) =>
                    rows.map((row, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...row,
                            accountId: value === 'none' ? '' : value,
                            name: row.name || expenseAccounts.find((account) => String(account.id) === value)?.name || '',
                          }
                        : row
                    )
                  )
                }
              >
                <SelectTrigger aria-label={`Category ${index + 1} account`} className="h-9">
                  <SelectValue placeholder="Pick an account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Group header only</SelectItem>
                  {expenseAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>

              <Input
                aria-label={`Category ${index + 1} name`}
                className="h-9 w-[110px] flex-1 sm:max-w-[200px]"
                value={item.name}
                onChange={(event) =>
                  setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, name: event.target.value } : row)))
                }
                placeholder="Label"
              />

              {type === 'PERCENT_INCOME' ? (
                <div className="relative w-24 shrink-0">
                  <Input
                    aria-label={`Category ${index + 1} percent`}
                    className="h-9 pr-6 text-right"
                    inputMode="decimal"
                    value={item.percent}
                    onChange={(event) =>
                      setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, percent: event.target.value } : row)))
                    }
                    placeholder="0"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">%</span>
                </div>
              ) : (
                <div className="relative w-24 shrink-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">₹</span>
                  <Input
                    aria-label={`Category ${index + 1} amount`}
                    className="h-9 pl-5 text-right"
                    inputMode="decimal"
                    value={item.amount}
                    onChange={(event) =>
                      setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, amount: event.target.value } : row)))
                    }
                    placeholder="0"
                  />
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove category ${index + 1}`}
                onClick={() => {
                  if (item.id) setRemoved((ids) => [...ids, item.id!]);
                  setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
                }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        {budget && onDelete ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => run(onDelete, 'Could not delete the budget')}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Delete budget
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => run(save, 'Could not save the budget')} disabled={busy}>
          {busy ? 'Saving…' : budget ? 'Save budget' : 'Create budget'}
        </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

function GoalEditor({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useGetAccounts();
  const createGoal = useCreateGoal();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('none');

  const save = async () => {
    if (!name.trim() || !target) {
      toast.error('Name the goal and set a target');
      return;
    }
    try {
      await createGoal.mutateAsync({
        name: name.trim(),
        targetAmountPaise: toPaise(target),
        targetDate: targetDate || null,
        linkedAccountId: accountId === 'none' ? null : Number(accountId),
      });
      toast.success('Goal created');
      onClose();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message ?? 'Could not create the goal');
    }
  };

  return (
    <DialogContent className="w-[min(520px,95vw)]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" aria-hidden="true" />
          New goal
        </DialogTitle>
        <DialogDescription>Link a savings account and progress comes from its real balance.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="goal-name">What are you saving for?</Label>
          <Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Emergency fund" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target (₹)</Label>
            <Input id="goal-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="500000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-date">Target date</Label>
            <Input id="goal-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal-account">Track an account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id="goal-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Track contributions manually</SelectItem>
              {accounts
                .filter((account) => account.type === 'ASSET')
                .map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={createGoal.isPending}>
          {createGoal.isPending ? 'Creating…' : 'Create goal'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ContributeDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { data: accounts = [] } = useGetAccounts();
  const contribute = useContributeToGoal();
  const auto = useAutoContribute();
  const [amount, setAmount] = useState('');
  const [fromAccountId, setFromAccountId] = useState('none');
  const [mode, setMode] = useState<'once' | 'auto'>('once');
  const [day, setDay] = useState('5');

  const submit = async () => {
    const amountPaise = toPaise(amount);
    if (amountPaise === '0') {
      toast.error('Enter an amount');
      return;
    }
    if (goal.linkedAccountId && fromAccountId === 'none') {
      toast.error('Choose the account the money comes from');
      return;
    }
    try {
      if (mode === 'auto') {
        if (fromAccountId === 'none') {
          toast.error('Choose the account the money comes from');
          return;
        }
        await auto.mutateAsync({
          id: goal.id,
          amountPaise,
          dayOfMonth: Math.min(28, Math.max(1, Number(day) || 5)),
          fromAccountId: Number(fromAccountId),
        });
        toast.success(`Monthly contribution scheduled for day ${day}`);
      } else {
        await contribute.mutateAsync({
          id: goal.id,
          amountPaise,
          fromAccountId: fromAccountId === 'none' ? undefined : Number(fromAccountId),
        });
        toast.success('Contribution recorded');
      }
      onClose();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message ?? 'Could not record the contribution');
    }
  };

  const busy = contribute.isPending || auto.isPending;

  return (
    <DialogContent className="w-[min(480px,95vw)]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
          Contribute to {goal.name}
        </DialogTitle>
        <DialogDescription>
          {goal.linkedAccountId
            ? 'This posts a real transfer into the linked account.'
            : 'No account is linked, so this adds to the goal balance directly.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contribute-amount">Amount (₹)</Label>
          <Input id="contribute-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="5000" autoFocus />
        </div>
        {goal.linkedAccountId ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="contribute-from">From account</Label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger id="contribute-from">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose an account</SelectItem>
                  {accounts
                    .filter((account) => account.type === 'ASSET' && account.id !== goal.linkedAccountId)
                    .map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('once')}
                aria-pressed={mode === 'once'}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] transition-colors',
                  mode === 'once' ? 'border-primary bg-primary/10 text-primary-strong' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                One time
              </button>
              <button
                type="button"
                onClick={() => setMode('auto')}
                aria-pressed={mode === 'auto'}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] transition-colors',
                  mode === 'auto' ? 'border-primary bg-primary/10 text-primary-strong' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                Every month
              </button>
            </div>
            {mode === 'auto' ? (
              <div className="space-y-2">
                <Label htmlFor="contribute-day">Day of month</Label>
                <Input id="contribute-day" type="number" min={1} max={28} value={day} onChange={(event) => setDay(event.target.value)} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : mode === 'auto' ? 'Schedule' : 'Contribute'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TemplatesDialog({ onClose }: { onClose: () => void }) {
  const { data: templates = [] } = useBudgetTemplates();
  const fromTemplate = useBudgetFromTemplate();

  return (
    <DialogContent className="w-[min(620px,95vw)]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Start from a proven split
        </DialogTitle>
        <DialogDescription>Limits follow your real income for the month, so nothing is guesswork.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={fromTemplate.isPending}
            aria-label={`Use the ${template.name} template`}
            onClick={async () => {
              try {
                await fromTemplate.mutateAsync({ templateId: template.id });
                toast.success(`${template.name} budget created`);
                onClose();
              } catch (error) {
                const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
                toast.error(message ?? 'Could not create the budget');
              }
            }}
            className="flex w-full items-start gap-3 rounded-sm border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-foreground">{template.name}</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">{template.description}</span>
            </span>
            <ChevronRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function BudgetsTab() {
  const budgetsQuery = useBudgets();
  const summaryQuery = useBudgetSummary();
  const safeQuery = useSafeToSpend(30);
  const goalsQuery = useGoals();
  const alertsQuery = useBudgetAlerts();
  const { data: accounts = [] } = useGetAccounts();
  const deleteBudget = useDeleteBudget();
  const deleteGoal = useDeleteGoal();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetStatus | null>(null);
  const [presetAccount, setPresetAccount] = useState<number | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const budgets = budgetsQuery.data ?? [];
  const goals = goalsQuery.data ?? [];
  const safe = safeQuery.data;
  const summary = summaryQuery.data;
  const alerts = alertsQuery.data ?? [];

  const overBudget = budgets.filter((budget) => Number(budget.totalRemainingPaise) < 0).length;
  const unbudgeted = summary?.unbudgeted ?? [];

  const openNew = (accountId?: number) => {
    setEditing(null);
    setPresetAccount(accountId ?? null);
    setEditorOpen(true);
  };

  if (budgetsQuery.isError && summaryQuery.isError) {
    return (
      <div className="panel p-6">
        <ErrorState title="Budgets could not load" onRetry={() => budgetsQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Plan"
        title="Budgets & goals"
        description="Limits per category with live progress from the ledger. Unspent money carries forward, every bill already scheduled is reserved, and goals fill from real balances."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Templates
            </Button>
            <Button size="sm" onClick={() => openNew()} className="pill-glow">
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              New budget
            </Button>
          </div>
        }
      />

      <section className="panel glow-balance relative overflow-hidden p-5 sm:p-6" aria-label="Safe to spend">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="eyebrow">Safe to spend · next 30 days</p>
            {safeQuery.isLoading ? (
              <SkeletonBlock className="mt-2 h-12 w-56" />
            ) : (
              <p className="mono glow-balance mt-2 text-[38px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-foreground sm:text-[44px]">
                {rupees(safe?.safeToSpendPaise)}
              </p>
            )}
            <p className="mt-3 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
              Cash today, minus what your budgets still need, minus bills already scheduled and debt still owed.
              {overBudget > 0 ? ` ${overBudget} ${overBudget === 1 ? 'budget is' : 'budgets are'} already over.` : ' Every active budget is inside its limit.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {summary ? (
                <>
                  <span className="mono rounded-full border border-border bg-surface/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Saved {rupees(summary.savingsPaise)} this month · {Math.round(summary.savingsRate)}%
                  </span>
                  {summary.expenseChangePercent != null ? (
                    <span
                      className={cn(
                        'mono inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]',
                        summary.expenseChangePercent > 0
                          ? 'border-destructive/30 bg-destructive/5 text-destructive'
                          : 'border-success/30 bg-success/5 text-success'
                      )}
                    >
                      {summary.expenseChangePercent > 0 ? (
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                      )}
                      Spend {summary.expenseChangePercent > 0 ? 'up' : 'down'} {Math.abs(summary.expenseChangePercent).toFixed(0)}% vs last month
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border/70 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div>
              <dt className="eyebrow flex items-center gap-1.5">
                <Wallet className="h-3 w-3" aria-hidden="true" /> Cash
              </dt>
              <dd className="mono mt-1 text-[15px] tabular-nums text-foreground">{rupees(safe?.liquidPaise)}</dd>
            </div>
            <div>
              <dt className="eyebrow flex items-center gap-1.5">
                <Target className="h-3 w-3" aria-hidden="true" /> Budgets
              </dt>
              <dd className="mono mt-1 text-[15px] tabular-nums text-foreground">−{rupees(safe?.reservedBudgetPaise)}</dd>
            </div>
            <div>
              <dt className="eyebrow flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" aria-hidden="true" /> Bills due
              </dt>
              <dd className="mono mt-1 text-[15px] tabular-nums text-foreground">−{rupees(safe?.upcomingBillsPaise)}</dd>
            </div>
            <div>
              <dt className="eyebrow flex items-center gap-1.5">
                <TrendingDown className="h-3 w-3" aria-hidden="true" /> Debt
              </dt>
              <dd className="mono mt-1 text-[15px] tabular-nums text-foreground">−{rupees(safe?.debtDuesPaise)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {summary ? (
        <section className="panel grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:p-5" aria-label="This month">
          <Stat
            label="Income"
            value={rupees(summary.incomePaise)}
            hint={new Date(`${summary.month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          />
          <Stat label="Spent" value={rupees(summary.expensePaise)} hint="Completed entries only" />
          <Stat
            label="Saved"
            value={rupees(summary.savingsPaise)}
            tone={Number(summary.savingsPaise) >= 0 ? 'positive' : 'negative'}
            hint={`${Math.round(summary.savingsRate)}% savings rate`}
          />
          <Stat
            label="Vs last month"
            value={summary.expenseChangePercent == null ? '—' : `${summary.expenseChangePercent > 0 ? '+' : ''}${summary.expenseChangePercent.toFixed(0)}%`}
            tone={summary.expenseChangePercent == null ? 'default' : summary.expenseChangePercent > 0 ? 'negative' : 'positive'}
            hint="Total spending"
          />
        </section>
      ) : null}

      {budgetsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-64" />
        </div>
      ) : budgets.length === 0 ? (
        <section className="panel relative overflow-hidden p-8">
          <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="eyebrow">Nothing budgeted yet</p>
              <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-foreground">Give every rupee a job</h3>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                A budget reads the ledger you already keep. Start with the 50/30/20 split, or set your own limits per
                category and let FinTrack warn you at 50%, 80% and 100%.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setTemplatesOpen(true)}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Use a template
                </Button>
                <Button size="sm" variant="outline" onClick={() => openNew()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Set limits myself
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={() => {
                setEditing(budget);
                setPresetAccount(null);
                setEditorOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <section className="space-y-3" aria-label="Goals">
        <div className="flex items-end justify-between gap-3">
          <SectionHeading eyebrow="Save towards" title="Goals" description="Progress follows the account you link, so the number is always the real balance." />
          <Button variant="outline" size="sm" onClick={() => setGoalOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            New goal
          </Button>
        </div>

        {goalsQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
          </div>
        ) : goals.length === 0 ? (
          <div className="panel flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel border border-primary/25 bg-primary-soft">
                <Flag className="h-4 w-4 text-primary" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-foreground">No goals yet</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  An emergency fund, a trip, a laptop — link a savings account and watch it fill.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setGoalOpen(true)}>
              Set a goal
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {goals.map((goal) => (
              <div key={goal.id} className="group relative">
                <GoalCard goal={goal} onContribute={setContributing} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${goal.name}`}
                  className="absolute right-1 top-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={async () => {
                    try {
                      await deleteGoal.mutateAsync(goal.id);
                      toast.success('Goal archived');
                    } catch {
                      toast.error('Could not archive the goal');
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {unbudgeted.length > 0 ? (
        <section className="panel p-4 sm:p-5" aria-label="Unbudgeted spending">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Outside every budget</p>
              <p className="mt-1 text-[12px] text-muted-foreground">These categories moved money this month without a limit.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {unbudgeted.map((entry) => (
              <button
                key={entry.accountId}
                type="button"
                onClick={() => openNew(entry.accountId)}
                className="group flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-[11.5px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate">{entry.name}</span>
                <span className="mono tabular-nums text-muted-foreground">{rupees(entry.spentPaise)}</span>
                <Plus className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {alerts.length > 0 ? (
        <section className="panel p-4 sm:p-5" aria-label="Recent budget alerts">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            <p className="eyebrow">Recent alerts</p>
          </div>
          <ul className="mt-2 divide-y divide-border/60">
            {alerts.slice(0, 4).map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                <span className="min-w-0 truncate text-foreground">
                  {alert.itemName ?? alert.budgetName} ·{' '}
                  <span className="text-muted-foreground">
                    {alert.threshold >= 101 ? 'over budget' : `${alert.threshold}% reached`}
                  </span>
                </span>
                <span className="mono shrink-0 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {dateLabel(alert.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={editorOpen} onOpenChange={(open) => !open && setEditorOpen(false)}>
        {editorOpen ? (
          <BudgetEditor
            budget={editing}
            accounts={accounts}
            budgets={budgets}
            presetAccountId={presetAccount}
            onClose={() => setEditorOpen(false)}
            onDelete={
              editing
                ? async () => {
                    await deleteBudget.mutateAsync(editing.id);
                    toast.success('Budget deleted');
                    setEditorOpen(false);
                  }
                : undefined
            }
          />
        ) : null}
      </Dialog>

      <Dialog open={goalOpen} onOpenChange={(open) => !open && setGoalOpen(false)}>
        {goalOpen ? <GoalEditor onClose={() => setGoalOpen(false)} /> : null}
      </Dialog>

      <Dialog open={Boolean(contributing)} onOpenChange={(open) => !open && setContributing(null)}>
        {contributing ? <ContributeDialog goal={contributing} onClose={() => setContributing(null)} /> : null}
      </Dialog>

      <Dialog open={templatesOpen} onOpenChange={(open) => !open && setTemplatesOpen(false)}>
        {templatesOpen ? <TemplatesDialog onClose={() => setTemplatesOpen(false)} /> : null}
      </Dialog>

    </div>
  );
}
