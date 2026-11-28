import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Clock3,
  History,
  Pencil,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { InteractiveAreaChart } from '@/components/charts/InteractiveAreaChart';
import { SectionHeading } from '@/components/overview/primitives';
import { formatINR } from '@/lib/finance';
import { useGetAccounts } from '../hooks/useQueries';
import {
  useCreateRecurringRule,
  useDeleteRecurringRule,
  usePreviewRecurringDates,
  useRecurringAction,
  useRecurringForecast,
  useRecurringOccurrences,
  useRecurringRules,
  useRecurringSuggestions,
  useUpdateRecurringRule,
  type RecurringRule,
  type RecurringSuggestion,
  type RulePayload,
} from '../hooks/useRecurring';
import { toast } from 'sonner';

const WEEKDAYS = [
  { value: 'MO', label: 'Monday' },
  { value: 'TU', label: 'Tuesday' },
  { value: 'WE', label: 'Wednesday' },
  { value: 'TH', label: 'Thursday' },
  { value: 'FR', label: 'Friday' },
  { value: 'SA', label: 'Saturday' },
  { value: 'SU', label: 'Sunday' },
];

const NTH = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
  { value: '-1', label: 'Last' },
];

type FrequencyKind = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY_DAY' | 'MONTHLY_LAST' | 'MONTHLY_NTH' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

const isMonthly = (kind: FrequencyKind) => ['MONTHLY_DAY', 'MONTHLY_LAST', 'MONTHLY_NTH', 'QUARTERLY'].includes(kind);

function buildRRule(kind: FrequencyKind, options: {
  interval: number;
  weekday: string;
  monthDay: number;
  nth: string;
  month: number;
  custom: string;
}): string {
  switch (kind) {
    case 'DAILY':
      return `FREQ=DAILY;INTERVAL=${Math.max(1, options.interval)}`;
    case 'WEEKLY':
      return `FREQ=WEEKLY;INTERVAL=${Math.max(1, options.interval)};BYDAY=${options.weekday}`;
    case 'BIWEEKLY':
      return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${options.weekday}`;
    case 'MONTHLY_DAY':
      return `FREQ=MONTHLY;BYMONTHDAY=${Math.min(31, Math.max(1, options.monthDay))}`;
    case 'MONTHLY_LAST':
      return 'FREQ=MONTHLY;BYMONTHDAY=-1';
    case 'MONTHLY_NTH':
      return `FREQ=MONTHLY;BYDAY=${options.nth}${options.weekday}`;
    case 'QUARTERLY':
      return `FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=${Math.min(31, Math.max(1, options.monthDay))}`;
    case 'YEARLY':
      return `FREQ=YEARLY;BYMONTH=${options.month};BYMONTHDAY=${Math.min(31, Math.max(1, options.monthDay))}`;
    case 'CUSTOM':
    default:
      return options.custom.replace(/^RRULE:/i, '');
  }
}

function describeRRule(rrule: string): string {
  const upper = rrule.toUpperCase();
  if (upper.includes('FREQ=DAILY')) return upper.includes('INTERVAL=1') || !upper.includes('INTERVAL') ? 'Every day' : `Every ${upper.match(/INTERVAL=(\d+)/)?.[1]} days`;
  if (upper.includes('FREQ=WEEKLY')) {
    const day = upper.match(/BYDAY=([A-Z]{2})/)?.[1];
    const label = WEEKDAYS.find((weekday) => weekday.value === day)?.label ?? '';
    if (upper.includes('INTERVAL=2')) return `Every other ${label || 'week'}`;
    return label ? `Every ${label}` : 'Every week';
  }
  if (upper.includes('FREQ=MONTHLY')) {
    if (upper.includes('BYMONTHDAY=-1')) return upper.includes('INTERVAL=3') ? 'Quarterly, last day' : 'Monthly, last day';
    const nth = upper.match(/BYDAY=(-?\d)([A-Z]{2})/);
    if (nth) return `Monthly, ${NTH.find((entry) => entry.value === nth[1])?.label} ${WEEKDAYS.find((entry) => entry.value === nth[2])?.label}`;
    const day = upper.match(/BYMONTHDAY=(\d+)/)?.[1];
    if (upper.includes('INTERVAL=3')) return `Quarterly on day ${day ?? ''}`.trim();
    return day ? `Monthly on day ${day}` : 'Every month';
  }
  if (upper.includes('FREQ=YEARLY')) return 'Every year';
  return rrule;
}

const toRupeeInput = (paise: string) => {
  const value = Number(paise) / 100;
  return Number.isFinite(value) ? String(value) : '0';
};
const toPaise = (rupees: string) => String(Math.round(Number(rupees || '0') * 100));

const nextDateLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const days = Math.round((date.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 0 && days < 7) return `In ${days} days`;
  if (days < 0) return `${Math.abs(days)} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

function StatusPill({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'default' : 'secondary'} className="gap-1 font-mono text-[10px] uppercase tracking-[0.08em]">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-success' : 'bg-muted-foreground'}`} aria-hidden="true" />
      {active ? 'Active' : 'Paused'}
    </Badge>
  );
}

interface SplitRow {
  accountId: string;
  amount: string;
}

const blankRows = (): SplitRow[] => [
  { accountId: '', amount: '' },
  { accountId: '', amount: '' },
];

interface EditorState {
  name: string;
  description: string;
  rows: SplitRow[];
  kind: FrequencyKind;
  interval: number;
  weekday: string;
  monthDay: number;
  nth: string;
  month: number;
  custom: string;
  startDate: string;
  endDate: string;
  maxRuns: string;
  mode: 'AUTO_POST' | 'CONFIRM';
  catchUp: 'ALL' | 'LATEST' | 'SKIP';
  weekendPolicy: 'SAME' | 'PREV_BUSINESS' | 'NEXT_BUSINESS';
  amountMode: 'FIXED' | 'ASK' | 'FORMULA';
  formulaAccount: string;
  formulaPercent: string;
  remindDaysBefore: number;
}

const todayISO = new Date().toISOString().slice(0, 10);

const emptyEditor = (): EditorState => ({
  name: '',
  description: '',
  rows: blankRows(),
  kind: 'MONTHLY_DAY',
  interval: 1,
  weekday: 'MO',
  monthDay: Number(todayISO.slice(8, 10)),
  nth: '1',
  month: Number(todayISO.slice(5, 7)),
  custom: 'FREQ=MONTHLY;BYMONTHDAY=1',
  startDate: todayISO,
  endDate: '',
  maxRuns: '',
  mode: 'AUTO_POST',
  catchUp: 'ALL',
  weekendPolicy: 'SAME',
  amountMode: 'FIXED',
  formulaAccount: '',
  formulaPercent: '5',
  remindDaysBefore: 0,
});

function RuleEditorDialog({
  open,
  onOpenChange,
  accounts,
  editing,
  seed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: { id: number; name: string; type: string }[];
  editing: RecurringRule | null;
  seed?: RecurringSuggestion | null;
}) {
  const [state, setState] = useState<EditorState>(emptyEditor);
  const createRule = useCreateRecurringRule();
  const updateRule = useUpdateRecurringRule();
  const preview = usePreviewRecurringDates();
  const [previewDates, setPreviewDates] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setState({
        ...emptyEditor(),
        name: editing.name,
        description: editing.template.description,
        rows: editing.template.lines.map((line) => ({ accountId: String(line.accountId), amount: toRupeeInput(line.amountPaise) })),
        kind: editing.rrule.includes('FREQ=DAILY')
          ? 'DAILY'
          : editing.rrule.includes('INTERVAL=2')
            ? 'BIWEEKLY'
            : editing.rrule.includes('FREQ=WEEKLY')
              ? 'WEEKLY'
              : editing.rrule.includes('BYMONTHDAY=-1')
                ? 'MONTHLY_LAST'
                : editing.rrule.includes('BYDAY=') && editing.rrule.includes('MO') && /BYDAY=-?\d/.test(editing.rrule)
                  ? 'MONTHLY_NTH'
                  : editing.rrule.includes('INTERVAL=3')
                    ? 'QUARTERLY'
                    : editing.rrule.includes('FREQ=YEARLY')
                      ? 'YEARLY'
                      : 'CUSTOM',
        custom: editing.rrule,
        startDate: editing.startDate,
        endDate: editing.endDate ?? '',
        maxRuns: editing.maxRuns ? String(editing.maxRuns) : '',
        mode: editing.mode,
        catchUp: editing.catchUp,
        weekendPolicy: editing.weekendPolicy,
        amountMode: editing.amountMode,
        formulaAccount: editing.formula ? String(editing.formula.accountId) : '',
        formulaPercent: editing.formula ? String(editing.formula.percent) : '5',
        remindDaysBefore: editing.remindDaysBefore,
      });
    } else if (seed) {
      setState({
        ...emptyEditor(),
        name: seed.description,
        description: seed.description,
        rows: seed.lines.map((line) => ({ accountId: String(line.accountId), amount: toRupeeInput(line.amountPaise) })),
        kind: 'CUSTOM',
        custom: seed.rrule,
        startDate: seed.startDate,
      });
    } else {
      setState(emptyEditor());
    }
  }, [open, editing, seed]);

  const rrule = useMemo(
    () =>
      buildRRule(state.kind, {
        interval: state.interval,
        weekday: state.weekday,
        monthDay: state.monthDay,
        nth: state.nth,
        month: state.month,
        custom: state.custom,
      }),
    [state.kind, state.interval, state.weekday, state.monthDay, state.nth, state.month, state.custom]
  );

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      preview.mutate(
        { rrule, startDate: state.startDate, endDate: state.endDate || null, weekendPolicy: state.weekendPolicy },
        { onSuccess: (dates) => setPreviewDates(dates) }
      );
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rrule, state.startDate, state.endDate, state.weekendPolicy]);

  const linePaise = state.rows.map((row) => Number(toPaise(row.amount)));
  const total = linePaise.reduce((sum, value) => sum + value, 0);
  const balanced = total === 0 && linePaise.some((value) => value !== 0);

  const updateRow = (index: number, patch: Partial<SplitRow>) =>
    setState((current) => ({ ...current, rows: current.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));

  const addRow = () => setState((current) => ({ ...current, rows: [...current.rows, { accountId: '', amount: '' }] }));

  const removeRow = (index: number) =>
    setState((current) => ({ ...current, rows: current.rows.filter((_, i) => i !== index) }));

  const autoBalance = () => {
    setState((current) => {
      if (current.rows.length < 2) return current;
      const values = current.rows.map((row) => Number(toPaise(row.amount)));
      const sumWithoutLast = values.slice(0, -1).reduce((sum, value) => sum + value, 0);
      const rows = [...current.rows];
      rows[rows.length - 1] = { ...rows[rows.length - 1], amount: String(-sumWithoutLast / 100) };
      return { ...current, rows };
    });
  };

  const save = async () => {
    if (!state.name.trim()) {
      toast.error('Give the rule a name');
      return;
    }
    if (state.rows.some((row) => !row.accountId || !row.amount)) {
      toast.error('Every split needs an account and an amount');
      return;
    }
    if (!balanced) {
      toast.error('Splits must balance: debits and credits need to match');
      return;
    }
    const payload: RulePayload = {
      name: state.name.trim(),
      template: {
        description: state.description.trim() || state.name.trim(),
        lines: state.rows.map((row) => ({ accountId: Number(row.accountId), amountPaise: toPaise(row.amount) })),
      },
      rrule,
      startDate: state.startDate,
      endDate: state.endDate || null,
      maxRuns: state.maxRuns ? Number(state.maxRuns) : null,
      mode: state.mode,
      catchUp: state.catchUp,
      weekendPolicy: state.weekendPolicy,
      amountMode: state.amountMode,
      formula:
        state.amountMode === 'FORMULA' && state.formulaAccount
          ? { kind: 'PERCENT_OF_BALANCE', accountId: Number(state.formulaAccount), percent: Number(state.formulaPercent) }
          : null,
      remindDaysBefore: state.remindDaysBefore,
    };
    try {
      if (editing) {
        await updateRule.mutateAsync({ id: editing.id, ...payload });
        toast.success('Rule updated');
      } else {
        await createRule.mutateAsync(payload);
        toast.success('Recurring rule created');
      }
      onOpenChange(false);
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message ?? 'Could not save the rule');
    }
  };

  const busy = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(920px,95vw)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" aria-hidden="true" />
            {editing ? 'Edit recurring rule' : 'New recurring rule'}
          </DialogTitle>
          <DialogDescription>
            Money moves on its own schedule. Post it automatically or approve each draft.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule name</Label>
                <Input id="rule-name" value={state.name} onChange={(event) => setState({ ...state, name: event.target.value })} placeholder="Flat rent" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-description">Transaction description</Label>
                <Input
                  id="rule-description"
                  value={state.description}
                  onChange={(event) => setState({ ...state, description: event.target.value })}
                  placeholder="Rent for {{date}}"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Splits</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={autoBalance}>
                    Balance
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Split
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {state.rows.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select value={row.accountId} onValueChange={(value) => updateRow(index, { accountId: value })}>
                      <SelectTrigger className="min-w-0 flex-1">
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      inputMode="decimal"
                      className="w-32 text-right font-mono"
                      value={row.amount}
                      onChange={(event) => updateRow(index, { amount: event.target.value })}
                      placeholder="0.00"
                      aria-label={`Amount for split ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove split ${index + 1}`}
                      onClick={() => removeRow(index)}
                      disabled={state.rows.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className={`mono text-[11px] ${balanced ? 'text-success' : 'text-muted-foreground'}`}>
                {balanced ? 'Balanced' : `Out by ${formatINR(Math.abs(total))} - positive is a debit, negative a credit`}
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-4">
              <Label>Repeats</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={state.kind} onValueChange={(value) => setState({ ...state, kind: value as FrequencyKind })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="BIWEEKLY">Every 2 weeks</SelectItem>
                    <SelectItem value="MONTHLY_DAY">Monthly on a day</SelectItem>
                    <SelectItem value="MONTHLY_LAST">Monthly on the last day</SelectItem>
                    <SelectItem value="MONTHLY_NTH">Monthly on the Nth weekday</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                    <SelectItem value="CUSTOM">Custom (RRULE)</SelectItem>
                  </SelectContent>
                </Select>

                {(state.kind === 'DAILY' || state.kind === 'WEEKLY' || state.kind === 'BIWEEKLY') && (
                  <Select value={state.weekday} onValueChange={(value) => setState({ ...state, weekday: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((weekday) => (
                        <SelectItem key={weekday.value} value={weekday.value}>
                          {weekday.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(isMonthly(state.kind) || state.kind === 'YEARLY') && (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-muted-foreground">Day</span>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      className="font-mono"
                      value={state.monthDay}
                      onChange={(event) => setState({ ...state, monthDay: Number(event.target.value) })}
                    />
                  </div>
                )}

                {state.kind === 'MONTHLY_NTH' && (
                  <div className="flex gap-2">
                    <Select value={state.nth} onValueChange={(value) => setState({ ...state, nth: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NTH.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={state.weekday} onValueChange={(value) => setState({ ...state, weekday: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((weekday) => (
                          <SelectItem key={weekday.value} value={weekday.value}>
                            {weekday.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {state.kind === 'YEARLY' && (
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    aria-label="Month"
                    className="font-mono"
                    value={state.month}
                    onChange={(event) => setState({ ...state, month: Number(event.target.value) })}
                  />
                )}

                {state.kind === 'CUSTOM' && (
                  <Input
                    className="font-mono text-[12px]"
                    value={state.custom}
                    onChange={(event) => setState({ ...state, custom: event.target.value })}
                    aria-label="Custom RRULE"
                  />
                )}
              </div>
              <p className="mono text-[11px] text-muted-foreground">{describeRRule(rrule)}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-start" className="text-[11px] text-muted-foreground">Starts</Label>
                  <Input id="rule-start" type="date" value={state.startDate} onChange={(event) => setState({ ...state, startDate: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-end" className="text-[11px] text-muted-foreground">Ends (optional)</Label>
                  <Input id="rule-end" type="date" value={state.endDate} onChange={(event) => setState({ ...state, endDate: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-max" className="text-[11px] text-muted-foreground">Max runs</Label>
                  <Input
                    id="rule-max"
                    type="number"
                    min={1}
                    placeholder="No limit"
                    value={state.maxRuns}
                    onChange={(event) => setState({ ...state, maxRuns: event.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-4">
              <Label>How should it post?</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['AUTO_POST', 'CONFIRM'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setState({ ...state, mode })}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      state.mode === mode ? 'border-primary/40 bg-primary-soft' : 'border-border hover:border-border-strong'
                    }`}
                    aria-pressed={state.mode === mode}
                  >
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                      {mode === 'AUTO_POST' ? <Zap className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {mode === 'AUTO_POST' ? 'Automatic' : 'Ask me'}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                      {mode === 'AUTO_POST' ? 'Posts straight to the ledger' : 'Creates a draft to approve'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Amount</Label>
                <Select value={state.amountMode} onValueChange={(value) => setState({ ...state, amountMode: value as EditorState['amountMode'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed amount</SelectItem>
                    <SelectItem value="ASK">Ask me each time</SelectItem>
                    <SelectItem value="FORMULA">Percent of a balance</SelectItem>
                  </SelectContent>
                </Select>
                {state.amountMode === 'FORMULA' && (
                  <div className="flex items-center gap-2">
                    <Select value={state.formulaAccount} onValueChange={(value) => setState({ ...state, formulaAccount: value })}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-20 font-mono"
                      inputMode="decimal"
                      value={state.formulaPercent}
                      onChange={(event) => setState({ ...state, formulaPercent: event.target.value })}
                      aria-label="Percent"
                    />
                    <span className="text-[12px] text-muted-foreground">%</span>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label className="text-[11px] text-muted-foreground">If a run is missed</Label>
                <Select value={state.catchUp} onValueChange={(value) => setState({ ...state, catchUp: value as EditorState['catchUp'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Post every missed run</SelectItem>
                    <SelectItem value="LATEST">Post only the latest</SelectItem>
                    <SelectItem value="SKIP">Skip missed runs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-[11px] text-muted-foreground">When it lands on a weekend</Label>
                <Select
                  value={state.weekendPolicy}
                  onValueChange={(value) => setState({ ...state, weekendPolicy: value as EditorState['weekendPolicy'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAME">Keep the same day</SelectItem>
                    <SelectItem value="PREV_BUSINESS">Previous business day</SelectItem>
                    <SelectItem value="NEXT_BUSINESS">Next business day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="rule-remind" className="text-[11px] text-muted-foreground">
                  Remind me before
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="rule-remind"
                    type="number"
                    min={0}
                    max={60}
                    className="w-20 font-mono"
                    value={state.remindDaysBefore}
                    onChange={(event) => setState({ ...state, remindDaysBefore: Number(event.target.value) })}
                  />
                  <span className="text-[12px] text-muted-foreground">days</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <p className="eyebrow mb-3">Next dates</p>
              {previewDates.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No dates yet - check the repeat settings.</p>
              ) : (
                <ol className="space-y-1.5">
                  {previewDates.slice(0, 5).map((date) => (
                    <li key={date} className="flex items-center justify-between mono text-[12px]">
                      <span className="text-foreground">{new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
                      <span className="text-muted-foreground">{nextDateLabel(date)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save rule' : 'Create rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OccurrenceHistoryDialog({ ruleId, onClose }: { ruleId: string | null; onClose: () => void }) {
  const { data, isLoading } = useRecurringOccurrences(ruleId);
  return (
    <Dialog open={Boolean(ruleId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] w-[min(720px,95vw)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run history</DialogTitle>
          <DialogDescription>Every occurrence this rule generated, newest first.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Nothing has run yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {data!.map((occurrence) => (
              <div key={occurrence.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="mono text-[12px] text-foreground">{occurrence.dueDate}</p>
                  {occurrence.error ? <p className="truncate text-[11px] text-destructive">{occurrence.error}</p> : null}
                  {occurrence.note ? <p className="truncate text-[11px] text-muted-foreground">{occurrence.note}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  {occurrence.amountPaise ? <span className="mono text-[12px] text-foreground">{formatINR(Number(occurrence.amountPaise))}</span> : null}
                  <Badge
                    variant={
                      occurrence.status === 'POSTED'
                        ? 'default'
                        : occurrence.status === 'FAILED'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="font-mono text-[10px] uppercase"
                  >
                    {occurrence.status}
                  </Badge>
                  {occurrence.transactionId ? (
                    <a
                      href={`/?tab=transactions&tx=${occurrence.transactionId}`}
                      className="mono text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      #{occurrence.transactionId}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RecurringTab() {
  const { data, isLoading } = useRecurringRules();
  const { data: accounts } = useGetAccounts();
  const { data: suggestions } = useRecurringSuggestions();
  const [days, setDays] = useState(30);
  const { data: forecast, isLoading: forecastLoading } = useRecurringForecast(days);
  const action = useRecurringAction();
  const deleteRule = useDeleteRecurringRule();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [seed, setSeed] = useState<RecurringSuggestion | null>(null);
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);

  const rules = data?.data ?? [];
  const upcoming = data?.upcoming ?? {};

  const monthlyCommitment = useMemo(() => {
    return rules
      .filter((rule) => rule.isActive)
      .reduce((sum, rule) => {
        const total = rule.template.lines.filter((line) => Number(line.amountPaise) > 0).reduce((inner, line) => inner + Number(line.amountPaise), 0);
        if (rule.rrule.includes('FREQ=DAILY')) return sum + total * 30;
        if (rule.rrule.includes('FREQ=WEEKLY')) return sum + total * (rule.rrule.includes('INTERVAL=2') ? 2 : 4);
        if (rule.rrule.includes('INTERVAL=3')) return sum + total / 3;
        if (rule.rrule.includes('FREQ=YEARLY')) return sum + total / 12;
        return sum + total;
      }, 0);
  }, [rules]);

  const nextRule = useMemo(
    () =>
      rules
        .filter((rule) => rule.isActive)
        .slice()
        .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0] ?? null,
    [rules]
  );

  const upcomingDays = useMemo(() => {
    const map = new Map<string, RecurringRule[]>();
    for (const rule of rules) {
      for (const entry of upcoming[rule.id] ?? []) {
        map.set(entry.dueDate, [...(map.get(entry.dueDate) ?? []), rule]);
      }
    }
    const start = new Date();
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + index));
      const key = date.toISOString().slice(0, 10);
      return { key, date, rules: map.get(key) ?? [] };
    });
  }, [rules, upcoming]);

  const endBalance = forecast && forecast.length > 0 ? forecast[forecast.length - 1].balance : null;
  const chartData = (forecast ?? []).map((point) => ({ ...point }));

  const runAction = async (id: string, kind: 'pause' | 'resume' | 'skip-next' | 'run-now') => {
    try {
      await action.mutateAsync({ id, action: kind });
      toast.success(
        kind === 'run-now' ? 'Rule processed' : kind === 'skip-next' ? 'Next occurrence skipped' : kind === 'pause' ? 'Rule paused' : 'Rule resumed'
      );
    } catch {
      toast.error('That did not work. Try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          eyebrow="Planning"
          title="Recurring money"
          description="Rent, salary, subscriptions and savings transfers on a schedule you set once."
        />
        <Button
          onClick={() => {
            setEditing(null);
            setSeed(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          New rule
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow">Active rules</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{rules.filter((rule) => rule.isActive).length}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{rules.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow">Monthly commitment</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{formatINR(monthlyCommitment, { compact: true })}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Normalised per month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow">Next run</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-foreground">{nextRule ? nextRule.name : 'Nothing scheduled'}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{nextRule ? nextDateLabel(nextRule.nextRunAt) : 'Create a rule to get started'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="eyebrow">Balance in {days} days</p>
            <p className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${endBalance !== null && endBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {endBalance === null ? '—' : formatINR(Math.round(endBalance * 100), { compact: true })}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">Bank and cash after scheduled money</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                Cash-flow forecast
              </CardTitle>
              <p className="mt-1 text-[12px] text-muted-foreground">Liquid balances plus every scheduled entry.</p>
            </div>
            <div className="flex rounded-full border border-border p-0.5">
              {[30, 60, 90].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDays(option)}
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    days === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option}d
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {forecastLoading || chartData.length === 0 ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <InteractiveAreaChart
                data={chartData}
                dataKey="balance"
                color="hsl(var(--chart-1))"
                height={260}
                name="Balance"
                formatter={(value) => formatINR(Math.round(value * 100), { compact: true })}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Up next</CardTitle>
            <p className="mt-1 text-[12px] text-muted-foreground">The next five weeks.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-7 gap-1" role="list" aria-label="Upcoming recurring days">
              {upcomingDays.map((day) => (
                <div
                  key={day.key}
                  role="listitem"
                  title={day.rules.length ? `${day.key}: ${day.rules.map((rule) => rule.name).join(', ')}` : day.key}
                  className={`flex h-9 flex-col items-center justify-center rounded-md border text-[10px] ${
                    day.rules.length
                      ? 'border-primary/35 bg-primary-soft text-primary-strong'
                      : 'border-border/60 bg-surface/40 text-muted-foreground'
                  }`}
                >
                  <span className="mono leading-none">{day.date.getUTCDate()}</span>
                  <span className="mt-1 leading-none" aria-hidden="true">
                    {day.rules.length ? '•'.repeat(Math.min(day.rules.length, 3)) : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {upcomingDays
                .filter((day) => day.rules.length > 0)
                .slice(0, 4)
                .map((day) => (
                  <div key={`list-${day.key}`} className="flex items-start justify-between gap-2 border-t border-border/70 pt-2">
                    <span className="mono text-[11px] text-muted-foreground">{nextDateLabel(day.key)}</span>
                    <span className="truncate text-right text-[12px] text-foreground">{day.rules.map((rule) => rule.name).join(', ')}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {suggestions && suggestions.length > 0 ? (
        <div className="space-y-3">
          <SectionHeading eyebrow="Detected" title="Looks recurring to us" description="Repeated entries from your history. One click turns them into a rule." />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((suggestion) => (
              <Card key={suggestion.id} className="border-dashed">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-foreground">{suggestion.description}</p>
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                      {Math.round(suggestion.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {suggestion.occurrences} times · {describeRRule(suggestion.rrule)} · {formatINR(Number(suggestion.lines.filter((line) => Number(line.amountPaise) > 0).reduce((sum, line) => sum + Number(line.amountPaise), 0)))}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setEditing(null);
                      setSeed(suggestion);
                      setEditorOpen(true);
                    }}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Create rule
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-[15px]">Rules</CardTitle>
            <p className="mt-1 text-[12px] text-muted-foreground">Pause, skip or run any rule immediately.</p>
          </div>
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary-soft">
                <Repeat className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <p className="text-[14px] font-medium text-foreground">No recurring rules yet</p>
              <p className="max-w-sm text-[12px] text-muted-foreground">
                Set up rent, salary or SIPs once. Or tick anything in Transactions and choose “Make recurring”.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setSeed(null);
                  setEditorOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                New rule
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((rule) => {
                const amount = rule.template.lines
                  .filter((line) => Number(line.amountPaise) > 0)
                  .reduce((sum, line) => sum + Number(line.amountPaise), 0);
                return (
                  <li key={rule.id} className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-foreground">{rule.name}</p>
                        <StatusPill active={rule.isActive} />
                        {rule.mode === 'CONFIRM' ? (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">Needs approval</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {describeRRule(rule.rrule)} · {nextDateLabel(rule.nextRunAt)}
                        {rule.runCount > 0 ? ` · ${rule.runCount} runs` : ''}
                      </p>
                    </div>
                    <span className="mono text-[13px] font-medium text-foreground">{formatINR(amount)}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={rule.isActive ? `Pause ${rule.name}` : `Resume ${rule.name}`}
                        onClick={() => runAction(rule.id, rule.isActive ? 'pause' : 'resume')}
                      >
                        {rule.isActive ? <CirclePause className="h-4 w-4" aria-hidden="true" /> : <CirclePlay className="h-4 w-4" aria-hidden="true" />}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Skip next ${rule.name}`} onClick={() => runAction(rule.id, 'skip-next')}>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Run ${rule.name} now`} onClick={() => runAction(rule.id, 'run-now')}>
                        <Zap className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`History for ${rule.name}`} onClick={() => setHistoryRuleId(rule.id)}>
                        <History className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${rule.name}`}
                        onClick={() => {
                          setEditing(rule);
                          setSeed(null);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${rule.name}`}>
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete “{rule.name}”?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Past transactions stay in your ledger. Future occurrences stop immediately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep rule</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await deleteRule.mutateAsync(rule.id);
                                  toast.success('Rule deleted');
                                } catch {
                                  toast.error('Could not delete the rule');
                                }
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <RuleEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditing(null);
            setSeed(null);
          }
        }}
        accounts={accounts ?? []}
        editing={editing}
        seed={seed}
      />
      <OccurrenceHistoryDialog ruleId={historyRuleId} onClose={() => setHistoryRuleId(null)} />
    </div>
  );
}
