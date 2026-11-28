import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  FlaskConical,
  History,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Terminal,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ErrorState, SectionHeading, SkeletonBlock } from './overview/primitives';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/finance';
import {
  describeTrigger,
  useArchiveAutomation,
  useAutomationDetail,
  useAutomationTemplates,
  useAutomations,
  useCreateAutomation,
  useKillSwitch,
  useRestoreVersion,
  useRunAutomation,
  useUpdateAutomation,
  type Automation,
  type AutomationInput,
  type AutomationRun,
  type AutomationTemplate,
  type PlannedPost,
  type RunStatus,
  type TriggerType,
} from '../hooks/useAutomations';

const EVENT_OPTIONS = [
  { id: 'transaction.created', label: 'Transaction posted' },
  { id: 'transaction.updated', label: 'Transaction edited' },
  { id: 'transaction.voided', label: 'Transaction voided' },
  { id: 'transaction.restored', label: 'Transaction restored' },
  { id: 'transaction.completed', label: 'Transaction completed' },
  { id: 'account.changed', label: 'Account changed' },
];

const CRON_PRESETS = [
  { label: 'Every day, 9am', value: '0 9 * * *' },
  { label: 'Every Monday, 9am', value: '0 9 * * 1' },
  { label: '1st of the month, 9am', value: '0 9 1 * *' },
  { label: 'Every Friday, 6pm', value: '0 18 * * 5' },
];

const STARTER_SCRIPT = `// Runs when the trigger fires. post() writes a balanced entry through the ledger.
// Amounts are in paise, so 500000 is 5,000.00. Everything here is sandboxed.
const asset = accounts.filter((a) => a.type === 'ASSET');
const from = asset[0];
const to = asset[1];
if (!from || !to) throw new Error('Add two asset accounts first');

post('Automation transfer', [
  { account: from.name, amount: -500000 },
  { account: to.name, amount: 500000 },
], { date: today() });

log('Moved 5,000.00 from ' + from.name + ' to ' + to.name);`;

const TRIGGER_LABELS: Record<TriggerType, string> = {
  MANUAL: 'Manual',
  SCHEDULE: 'Schedule',
  EVENT: 'Ledger event',
  WEBHOOK: 'Webhook',
};

const STATUS_STYLE: Record<RunStatus, { label: string; className: string }> = {
  OK: { label: 'Posted', className: 'text-success border-success/30 bg-success/10' },
  DRY_RUN: { label: 'Rehearsed', className: 'text-primary border-primary/30 bg-primary/10' },
  FAILED: { label: 'Failed', className: 'text-destructive border-destructive/30 bg-destructive/10' },
  SKIPPED: { label: 'Skipped', className: 'text-warning border-warning/30 bg-warning/10' },
};

const rowKey = () => Math.random().toString(36).slice(2, 10);

interface Row {
  key: string;
  name: string;
  value: string;
}

const toRows = (record: Record<string, string | number> | undefined): Row[] =>
  Object.entries(record ?? {}).map(([name, value]) => ({ key: rowKey(), name, value: String(value) }));

const rowsToRecord = (rows: Row[]): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (name) record[name] = row.value;
  }
  return record;
};

const numericVariables = (rows: Row[]): Record<string, string | number> => {
  const record: Record<string, string | number> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    const raw = row.value.trim();
    record[name] = raw !== '' && Number.isFinite(Number(raw)) && String(Number(raw)) === raw ? Number(raw) : row.value;
  }
  return record;
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function StatusPill({ status }: { status: RunStatus | null }) {
  if (!status) return <span className="text-[11px] text-muted-foreground">No runs yet</span>;
  const style = STATUS_STYLE[status];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em]', style.className)}>
      {style.label}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-[12px] text-foreground">{label}</Label>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function RowsEditor({
  rows,
  onChange,
  placeholder,
  valuePlaceholder,
  masked,
  addLabel,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  placeholder: string;
  valuePlaceholder: string;
  masked?: boolean;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center gap-2">
          <Input
            aria-label={`${addLabel} name ${index + 1}`}
            value={row.name}
            placeholder={placeholder}
            onChange={(event) => onChange(rows.map((item) => (item.key === row.key ? { ...item, name: event.target.value } : item)))}
            className="h-10 min-w-0 flex-1 font-mono text-[12.5px]"
          />
          <Input
            aria-label={`${addLabel} value ${index + 1}`}
            value={row.value}
            type={masked ? 'password' : 'text'}
            placeholder={valuePlaceholder}
            onChange={(event) => onChange(rows.map((item) => (item.key === row.key ? { ...item, value: event.target.value } : item)))}
            className="h-10 min-w-0 flex-1 font-mono text-[12.5px]"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${row.name || addLabel}`}
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 gap-1.5"
        onClick={() => onChange([...rows, { key: rowKey(), name: '', value: '' }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add {addLabel}
      </Button>
    </div>
  );
}

export function AutomationsTab() {
  const list = useAutomations();
  const templates = useAutomationTemplates();
  const kill = useKillSwitch();
  const runNow = useRunAutomation();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const paused = list.data?.paused ?? false;
  const automations = list.data?.automations ?? [];
  const activeCount = automations.filter((automation) => automation.isActive).length;
  const runningId = runNow.isPending ? runNow.variables?.id : undefined;

  const toggleKillSwitch = (next: boolean) => {
    kill.mutate(next, {
      onSuccess: () => toast(next ? 'All automations paused' : 'Automations resumed'),
      onError: () => toast.error('Could not change the kill switch'),
    });
  };

  if (editor) {
    return (
      <AutomationEditor
        state={editor}
        templates={templates.data ?? []}
        onClose={() => setEditor(null)}
        onCreated={(id) => setEditor({ mode: 'edit', id })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Autopilot"
        title="Automations"
        description="Let the ledger do the recurring work. Every script runs in a sealed sandbox, posts only through double-entry accounts, and can be rehearsed before it goes live."
        action={
          <Button className="h-11 gap-2" onClick={() => setEditor({ mode: 'create' })}>
            <Plus className="h-4 w-4" /> New automation
          </Button>
        }
      />

      <div
        className={cn(
          'panel flex flex-wrap items-center justify-between gap-4 px-4 py-3 transition-colors',
          paused && 'border-warning/40 bg-warning/5'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
              paused ? 'border-warning/40 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success'
            )}
          >
            {paused ? <Pause className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">
              {paused ? 'Kill switch is on — nothing runs' : `Kill switch off — ${activeCount} of ${automations.length} live`}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {paused
                ? 'Schedules, events and webhooks are skipped until you resume. Rehearsals still work.'
                : 'Flip this to stop every automation for this account at once.'}
            </p>
          </div>
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
          <span className="text-[12px] text-muted-foreground">{paused ? 'Paused' : 'Running'}</span>
          <Switch checked={paused} disabled={kill.isPending || list.isLoading} onCheckedChange={toggleKillSwitch} aria-label="Pause all automations" />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {list.isLoading ? (
            <div className="space-y-3">
              <SkeletonBlock className="h-24 w-full" />
              <SkeletonBlock className="h-24 w-full" />
              <SkeletonBlock className="h-24 w-full" />
            </div>
          ) : list.isError ? (
            <div className="panel">
              <ErrorState title="Could not load automations" onRetry={() => void list.refetch()} />
            </div>
          ) : automations.length === 0 ? (
            <EmptyAutomations
              templates={templates.data ?? []}
              loading={templates.isLoading}
              onPick={(template) => setEditor({ mode: 'create', seed: template })}
              onScratch={() => setEditor({ mode: 'create' })}
            />
          ) : (
            automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                paused={paused}
                running={runningId === automation.id}
                onEdit={() => setEditor({ mode: 'edit', id: automation.id })}
                onHistory={() => setHistoryId(automation.id)}
                onRehearse={() =>
                  runNow.mutate(
                    { id: automation.id, dryRun: true },
                    {
                      onSuccess: (run) =>
                        toast.success(
                          run.status === 'SKIPPED'
                            ? run.error ?? 'Nothing to rehearse'
                            : (() => {
                                const count = run.planned?.length ?? 0;
                                return `${count} ${count === 1 ? 'entry' : 'entries'} rehearsed — nothing was posted`;
                              })()
                        ),
                      onError: () => toast.error('Rehearsal failed to start'),
                    }
                  )
                }
                onRun={() =>
                  runNow.mutate(
                    { id: automation.id, dryRun: false },
                    {
                      onSuccess: (run) =>
                        run.status === 'OK'
                          ? toast.success(`Posted ${run.transactionIds.length} entr${run.transactionIds.length === 1 ? 'y' : 'ies'}`)
                          : toast.message(run.status === 'SKIPPED' ? run.error ?? 'Skipped' : run.error ?? 'Run failed'),
                      onError: () => toast.error('Run failed to start'),
                    }
                  )
                }
              />
            ))
          )}
        </div>

        <aside className="space-y-3">
          <SandboxCard />
          <ToolkitCard />
          {templates.data && templates.data.length > 0 && automations.length > 0 ? (
            <div className="panel p-4">
              <p className="eyebrow mb-3">Templates</p>
              <div className="space-y-1">
                {templates.data.slice(0, 4).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setEditor({ mode: 'create', seed: template })}
                    className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control px-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <span className="truncate">{template.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <HistorySheet id={historyId} onClose={() => setHistoryId(null)} onEdit={(id) => { setHistoryId(null); setEditor({ mode: 'edit', id }); }} />
    </div>
  );
}

type EditorState = { mode: 'create'; seed?: AutomationTemplate } | { mode: 'edit'; id: string };

function EmptyAutomations({
  templates,
  loading,
  onPick,
  onScratch,
}: {
  templates: AutomationTemplate[];
  loading: boolean;
  onPick: (template: AutomationTemplate) => void;
  onScratch: () => void;
}) {
  return (
    <div className="panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="relative">
        <span className="flex h-11 w-11 items-center justify-center rounded-panel border border-primary/25 bg-primary-soft text-primary">
          <Zap className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.02em] text-foreground">Nothing runs on its own yet</h3>
        <p className="mt-1.5 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          Start from a template below, or write your own script. Nothing posts until you switch an automation on, and every run is rehearsable first.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {loading
            ? [0, 1, 2, 3].map((index) => <SkeletonBlock key={index} className="h-[86px] w-full" />)
            : templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onPick(template)}
                  className="group min-h-[86px] rounded-panel border border-border bg-background/40 p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground">{template.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">{template.description}</p>
                  <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/80">
                    {describeTrigger(template.triggerType, template.triggerConfig)}
                  </p>
                </button>
              ))}
        </div>

        <Button variant="outline" className="mt-4 h-11 gap-2" onClick={onScratch}>
          <Code2 className="h-4 w-4" /> Start from scratch
        </Button>
      </div>
    </div>
  );
}

function AutomationCard({
  automation,
  paused,
  running,
  onEdit,
  onHistory,
  onRehearse,
  onRun,
}: {
  automation: Automation;
  paused: boolean;
  running: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onRehearse: () => void;
  onRun: () => void;
}) {
  const live = automation.isActive && !paused;
  return (
    <article className="panel group relative overflow-hidden pl-4 transition-colors hover:border-border/80">
      <span
        className={cn('absolute inset-y-0 left-0 w-[3px]', live ? 'bg-primary' : automation.isActive ? 'bg-warning' : 'bg-muted-foreground/30')}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">{automation.name}</h3>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
                automation.isActive
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-muted/40 text-muted-foreground'
              )}
            >
              {automation.isActive ? 'Live' : 'Draft'}
            </span>
            {automation.failCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" /> {automation.failCount} failed
              </span>
            ) : null}
          </div>
          {automation.description ? (
            <p className="line-clamp-2 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">{automation.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
            <span>{describeTrigger(automation.triggerType, automation.triggerConfig)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{timeAgo(automation.lastRunAt)}</span>
            <span className="text-muted-foreground/40">·</span>
            <StatusPill status={automation.lastRunStatus} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-11 gap-1.5 px-3 text-[12px]"
            onClick={onRehearse}
            disabled={running}
            title="Run against the current ledger without posting"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            Rehearse
          </Button>
          <Button variant="outline" size="sm" className="h-11 gap-1.5 px-3 text-[12px]" onClick={onRun} disabled={running || !automation.isActive}>
            <Play className="h-3.5 w-3.5" /> Run now
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`History for ${automation.name}`} onClick={onHistory}>
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Edit ${automation.name}`} onClick={onEdit}>
            <Code2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function SandboxCard() {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="text-[12.5px] font-medium text-foreground">Sandbox limits</p>
      </div>
      <ul className="mt-3 space-y-1.5 text-[11.5px] text-muted-foreground">
        <li className="flex justify-between gap-2"><span>Wall clock</span><span className="font-mono text-foreground">5 s</span></li>
        <li className="flex justify-between gap-2"><span>Memory</span><span className="font-mono text-foreground">16 MB</span></li>
        <li className="flex justify-between gap-2"><span>Posts per run</span><span className="font-mono text-foreground">100</span></li>
        <li className="flex justify-between gap-2"><span>Network &amp; files</span><span className="font-mono text-foreground">blocked</span></li>
      </ul>
      <p className="mt-3 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Scripts cannot read secrets you have not granted, and every post must balance to zero or the run fails.
      </p>
    </div>
  );
}

function ToolkitCard() {
  const items: [string, string][] = [
    ['vars', 'your variables'],
    ['secrets', 'encrypted values'],
    ['today()', 'ISO date'],
    ['accounts', 'account list'],
    ['balance(name)', 'current balance'],
    ['transactions(opts)', 'recent entries'],
    ['budget(name)', 'spend vs limit'],
    ['post(desc, lines, opts)', 'write to the ledger'],
    ['log(...values)', 'run output'],
  ];
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <p className="text-[12.5px] font-medium text-foreground">Script toolkit</p>
      </div>
      <dl className="mt-3 space-y-1.5">
        {items.map(([name, description]) => (
          <div key={name} className="flex items-baseline justify-between gap-2 text-[11.5px]">
            <dt className="font-mono text-foreground">{name}</dt>
            <dd className="truncate text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AutomationEditor({
  state,
  templates,
  onClose,
  onCreated,
}: {
  state: EditorState;
  templates: AutomationTemplate[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const seed = state.mode === 'create' ? state.seed : undefined;
  const detail = useAutomationDetail(state.mode === 'edit' ? state.id : null);
  const create = useCreateAutomation();
  const update = useUpdateAutomation();
  const run = useRunAutomation();

  const [savedId, setSavedId] = useState<string | null>(state.mode === 'edit' ? state.id : null);
  const [loaded, setLoaded] = useState(state.mode === 'create');

  const [name, setName] = useState(seed?.name ?? '');
  const [description, setDescription] = useState(seed?.description ?? '');
  const [triggerType, setTriggerType] = useState<TriggerType>(seed?.triggerType ?? 'MANUAL');
  const [cron, setCron] = useState(seed?.triggerConfig?.cron ?? '0 9 1 * *');
  const [events, setEvents] = useState<string[]>(seed?.triggerConfig?.events ?? ['transaction.created']);
  const [script, setScript] = useState(seed?.script ?? STARTER_SCRIPT);
  const [variables, setVariables] = useState<Row[]>(toRows(seed?.variables));
  const [secretRows, setSecretRows] = useState<Row[]>([]);
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [rehearsal, setRehearsal] = useState<AutomationRun | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [showToolkit, setShowToolkit] = useState(false);

  const automation = detail.data?.automation;

  useEffect(() => {
    if (!automation || loaded) return;
    setName(automation.name);
    setDescription(automation.description ?? '');
    setTriggerType(automation.triggerType);
    setCron(automation.triggerConfig.cron ?? '0 9 1 * *');
    setEvents(automation.triggerConfig.events ?? []);
    setScript(automation.script);
    setVariables(toRows(automation.variables));
    setSecretKeys(automation.secretKeys);
    setIsActive(automation.isActive);
    setLoaded(true);
  }, [automation, loaded]);

  const templatesForType = useMemo(() => templates, [templates]);

  const applyTemplate = (templateId: string) => {
    const template = templatesForType.find((item) => item.id === templateId);
    if (!template) return;
    setName(template.name);
    setDescription(template.description);
    setTriggerType(template.triggerType);
    if (template.triggerConfig.cron) setCron(template.triggerConfig.cron);
    if (template.triggerConfig.events) setEvents(template.triggerConfig.events);
    setScript(template.script);
    setVariables(toRows(template.variables));
    setRehearsal(null);
  };

  const problems: string[] = [];
  if (!name.trim()) problems.push('Give the automation a name');
  if (triggerType === 'SCHEDULE' && cron.trim().split(/\s+/).length !== 5) problems.push('A schedule needs a 5-field cron expression');
  if (triggerType === 'EVENT' && events.length === 0) problems.push('Pick at least one ledger event');
  if (!script.trim()) problems.push('The script is empty');

  const busy = create.isPending || update.isPending;

  const buildInput = (): AutomationInput => ({
    name: name.trim(),
    description: description.trim() || null,
    triggerType,
    triggerConfig: triggerType === 'SCHEDULE' ? { cron: cron.trim() } : triggerType === 'EVENT' ? { events } : {},
    script,
    variables: numericVariables(variables),
    secrets: rowsToRecord(secretRows),
    isActive,
  });

  const save = (rehearseAfterSave: boolean) => {
    if (problems.length > 0) {
      toast.error(problems[0]);
      return;
    }
    const input = buildInput();
    if (savedId) {
      update.mutate(
        { id: savedId, ...input },
        {
          onSuccess: (updated) => {
            toast.success(`Saved ${updated.name}`);
            setSecretRows([]);
            setSecretKeys(updated.secretKeys);
            if (rehearseAfterSave) {
              run.mutate(
                { id: updated.id, dryRun: true },
                { onSuccess: setRehearsal, onError: () => toast.error('Rehearsal failed to start') }
              );
            }
          },
          onError: () => toast.error('Could not save the automation'),
        }
      );
      return;
    }
    create.mutate(input, {
      onSuccess: (created) => {
        setSavedId(created.id);
        onCreated(created.id);
        setSecretRows([]);
        setSecretKeys(created.secretKeys);
        if (created.webhookSecret) setWebhookSecret(created.webhookSecret);
        toast.success(`${created.name} saved as ${created.isActive ? 'live' : 'a draft'}`);
        if (rehearseAfterSave) {
          run.mutate(
            { id: created.id, dryRun: true },
            { onSuccess: setRehearsal, onError: () => toast.error('Rehearsal failed to start') }
          );
        }
      },
      onError: () => toast.error('Could not create the automation'),
    });
  };

  const toggleEvent = (eventId: string) =>
    setEvents((current) => (current.includes(eventId) ? current.filter((item) => item !== eventId) : [...current, eventId]));

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="-ml-2 h-11 gap-1.5 px-2 text-[12.5px]" onClick={onClose}>
        <ChevronRight className="h-4 w-4 rotate-180" /> All automations
      </Button>

      <section className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">{savedId ? 'Edit automation' : 'New automation'}</h2>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {savedId
                  ? 'Save to keep a version. Every change is snapshotted and can be restored.'
                  : 'Draft it here, rehearse it against real balances, then switch it on.'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {isActive ? 'Live' : 'Draft'}
            </span>
          </div>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6">
          {state.mode === 'create' && templates.length > 0 ? (
            <Field label="Start from a template" hint="optional">
              <Select value="" onValueChange={applyTemplate}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose a template to prefill the script" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Pay yourself first" className="h-11" maxLength={80} />
            </Field>
            <Field label="Description" hint="shown in the list">
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Moves 10% of income into savings on payday"
                className="h-11"
                maxLength={500}
              />
            </Field>
          </div>

          <section className="space-y-3">
            <p className="eyebrow">Trigger</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/30 p-1 sm:grid-cols-4">
              {(['MANUAL', 'SCHEDULE', 'EVENT', 'WEBHOOK'] as TriggerType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTriggerType(type)}
                  className={cn(
                    'flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition-colors',
                    triggerType === type ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {type === 'WEBHOOK' ? <Webhook className="h-3.5 w-3.5" /> : type === 'SCHEDULE' ? <Clock3 className="h-3.5 w-3.5" /> : type === 'EVENT' ? <Zap className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {TRIGGER_LABELS[type]}
                </button>
              ))}
            </div>

            {triggerType === 'SCHEDULE' ? (
              <div className="space-y-2 rounded-panel border border-border bg-background/40 p-3">
                <Field label="Cron (UTC)" hint="minute hour day month weekday">
                  <Input value={cron} onChange={(event) => setCron(event.target.value)} className="h-11 font-mono text-[13px]" placeholder="0 9 1 * *" />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCron(preset.value)}
                      className={cn(
                        'rounded-full border px-2.5 py-1.5 text-[11px] transition-colors',
                        cron === preset.value
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {triggerType === 'EVENT' ? (
              <div className="rounded-panel border border-border bg-background/40 p-3">
                <p className="mb-2 text-[11.5px] text-muted-foreground">Runs right after the ledger changes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_OPTIONS.map((option) => {
                    const selected = events.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleEvent(option.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-colors',
                          selected
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {triggerType === 'MANUAL' ? (
              <p className="rounded-control border border-border bg-background/40 px-3 py-2 text-[11.5px] text-muted-foreground">
                Runs only when you press Run now or Rehearse.
              </p>
            ) : null}

            {triggerType === 'WEBHOOK' ? (
              <div className="space-y-1.5 rounded-panel border border-border bg-background/40 p-3 text-[11.5px] text-muted-foreground">
                <p>Call it from anywhere with a POST and the automation key header.</p>
                <p className="break-all font-mono text-[11px] text-foreground">
                  POST /api/automations/hooks/{savedId ?? '<id>'} · x-automation-key: &lt;secret&gt;
                </p>
                {webhookSecret ? (
                  <p className="break-all rounded-control border border-success/30 bg-success/10 px-2 py-1.5 font-mono text-[11px] text-success">
                    Key (shown once): {webhookSecret}
                  </p>
                ) : (
                  <p>Save once to generate the key — it is shown a single time.</p>
                )}
              </div>
            ) : null}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Script</p>
              <button
                type="button"
                onClick={() => setShowToolkit((value) => !value)}
                className="flex min-h-[32px] items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Braces className="h-3.5 w-3.5" /> {showToolkit ? 'Hide' : 'Show'} the toolkit
              </button>
            </div>
            {showToolkit ? (
              <pre className="overflow-x-auto rounded-control border border-border bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`vars.<name>              numbers or text you set below
secrets.<name>           encrypted, never readable in the UI
today()                  ISO date string
accounts                 [{ name, type, subType, balancePaise }]
balance('HDFC Bank')     balance in paise
transactions({ since, contains, account })
budgets                  [{ name, percentUsed, pace, remainingPaise }]
budget('Groceries')      one budget status
post('desc', [{ account, amount }], { date, status })
log(...values)           printed in the run log`}
              </pre>
            ) : null}
            <Textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              spellCheck={false}
              aria-label="Automation script"
              className="min-h-[240px] font-mono text-[12.5px] leading-[1.7]"
            />
            <p className="text-[11px] text-muted-foreground">
              JavaScript, sandboxed: no network, no files, no timers. Entries must balance to zero or the run fails.
            </p>
          </section>

          <section className="space-y-2">
            <p className="eyebrow">Variables</p>
            <RowsEditor
              rows={variables}
              onChange={setVariables}
              placeholder="saveAmount"
              valuePlaceholder="5000"
              addLabel="variable"
            />
          </section>

          <section className="space-y-2">
            <p className="eyebrow">Secrets</p>
            {secretKeys.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {secretKeys.map((key) => (
                  <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    <KeyRound className="h-3 w-3" /> {key}
                  </span>
                ))}
              </div>
            ) : null}
            <RowsEditor
              rows={secretRows}
              onChange={setSecretRows}
              placeholder="apiKey"
              valuePlaceholder="value (encrypted)"
              masked
              addLabel="secret"
            />
            <p className="text-[11px] text-muted-foreground">
              {secretKeys.length > 0 ? 'Saved values are never shown again; adding a key here replaces it.' : 'Values are encrypted at rest and never returned by the API.'}
            </p>
          </section>

          {rehearsal ? <RehearsalPanel run={rehearsal} /> : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-3 backdrop-blur sm:px-6">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Automation active" />
            <span className="text-[12px] text-muted-foreground">{isActive ? 'Live — triggers will post' : 'Draft — saves without running'}</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" className="h-11" onClick={onClose}>
              Close
            </Button>
            <Button variant="outline" className="h-11 gap-2" onClick={() => save(true)} disabled={busy || run.isPending || problems.length > 0}>
              {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Save &amp; rehearse
            </Button>
            <Button className="h-11 gap-2" onClick={() => save(false)} disabled={busy || problems.length > 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {savedId ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function LedgerPreview({ post }: { post: PlannedPost }) {
  const total = post.lines.reduce((sum, line) => sum + line.amountPaise, 0);
  return (
    <div className="rounded-control border border-border/70 bg-background/60">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-[12px] font-medium text-foreground">{post.description}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">{post.date}</span>
      </div>
      <ul className="divide-y divide-border/50">
        {post.lines.map((line, index) => (
          <li key={`${line.account}-${index}`} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-6 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">{line.amountPaise >= 0 ? 'Dr' : 'Cr'}</span>
              <span className="truncate text-[12px] text-foreground">{line.account}</span>
            </span>
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-foreground">{formatINR(Math.abs(line.amountPaise))}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5">
        <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">Balances to</span>
        <span className={cn('font-mono text-[11px] tabular-nums', total === 0 ? 'text-success' : 'text-destructive')}>{formatINR(total)}</span>
      </div>
    </div>
  );
}

function RehearsalPanel({ run }: { run: AutomationRun }) {
  const style = STATUS_STYLE[run.status];
  return (
    <section className="space-y-2 rounded-panel border border-primary/25 bg-primary/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[12px] font-medium text-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> Rehearsal
        </p>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em]', style.className)}>
            {style.label}
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground">{run.durationMs} ms</span>
        </div>
      </div>

      {run.error ? (
        <p className="rounded-control border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 font-mono text-[11.5px] text-destructive">{run.error}</p>
      ) : null}

      {run.planned && run.planned.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Would post {run.planned.length} entr{run.planned.length === 1 ? 'y' : 'ies'} — nothing was written.</p>
          {run.planned.map((post, index) => (
            <LedgerPreview key={`${post.description}-${index}`} post={post} />
          ))}
        </div>
      ) : run.status === 'DRY_RUN' ? (
        <p className="text-[11.5px] text-muted-foreground">The script finished without posting anything.</p>
      ) : null}

      {run.logs.length > 0 ? (
        <pre className="max-h-40 overflow-auto rounded-control border border-border bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {run.logs.join('\n')}
        </pre>
      ) : null}
    </section>
  );
}

function HistorySheet({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (id: string) => void }) {
  const detail = useAutomationDetail(id);
  const restore = useRestoreVersion();
  const archive = useArchiveAutomation();
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  const automation = detail.data?.automation;
  const runs = detail.data?.runs ?? [];
  const versions = detail.data?.versions ?? [];

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <div className="border-b border-border px-5 py-4">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-[15px] tracking-[-0.02em]">{automation?.name ?? 'Automation'}</SheetTitle>
            <SheetDescription className="text-[12px] text-muted-foreground">
              {automation ? describeTrigger(automation.triggerType, automation.triggerConfig) : 'Loading history'}
            </SheetDescription>
          </SheetHeader>
          {automation ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => onEdit(automation.id)}>
                <Code2 className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 gap-1.5 text-muted-foreground hover:text-destructive"
                disabled={archive.isPending}
                onClick={() =>
                  archive.mutate(automation.id, {
                    onSuccess: () => { toast.success('Automation archived'); onClose(); },
                    onError: () => toast.error('Could not archive'),
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" /> Archive
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 px-5 py-4">
          {detail.isLoading ? (
            <div className="space-y-2">
              <SkeletonBlock className="h-16 w-full" />
              <SkeletonBlock className="h-16 w-full" />
            </div>
          ) : detail.isError ? (
            <ErrorState title="Could not load the history" onRetry={() => void detail.refetch()} />
          ) : (
            <>
              <section className="space-y-2">
                <p className="eyebrow">Runs</p>
                {runs.length === 0 ? (
                  <p className="rounded-control border border-dashed border-border px-3 py-4 text-center text-[11.5px] text-muted-foreground">
                    No runs yet. Rehearse it to see what it would post.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {runs.map((entry) => (
                      <li key={entry.id} className="rounded-panel border border-border bg-background/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusPill status={entry.status} />
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                            {entry.trigger.toLowerCase()} · {timeAgo(entry.createdAt)} · {entry.durationMs} ms
                          </span>
                        </div>
                        {entry.error ? <p className="mt-1.5 font-mono text-[11px] text-destructive">{entry.error}</p> : null}
                        {entry.transactionIds.length > 0 ? (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Posted {entry.transactionIds.length} entr{entry.transactionIds.length === 1 ? 'y' : 'ies'} · #{entry.transactionIds.join(', #')}
                          </p>
                        ) : null}
                        {entry.planned && entry.planned.length > 0 ? (
                          <div className="mt-2 space-y-1.5">
                            {entry.planned.map((post, index) => (
                              <LedgerPreview key={`${entry.id}-${index}`} post={post} />
                            ))}
                          </div>
                        ) : null}
                        {entry.logs.length > 0 ? (
                          <pre className="mt-2 max-h-32 overflow-auto rounded-control border border-border bg-black/40 p-2 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                            {entry.logs.join('\n')}
                          </pre>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="space-y-2">
                <p className="eyebrow">Versions</p>
                {versions.length === 0 ? (
                  <p className="text-[11.5px] text-muted-foreground">No saved versions yet.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {versions.map((version) => (
                      <li key={version.id} className="rounded-panel border border-border bg-background/40">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <button
                            type="button"
                            className="flex min-h-[36px] items-center gap-2 text-left text-[12px] text-foreground"
                            onClick={() => setOpenVersion((current) => (current === version.id ? null : version.id))}
                          >
                            <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', openVersion === version.id && 'rotate-90')} />
                            v{version.version}
                            <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                              {version.createdBy === 'RESTORE' ? 'restored' : 'saved'} {timeAgo(version.createdAt)}
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-1.5 text-[11.5px]"
                            disabled={restore.isPending}
                            onClick={() =>
                              restore.mutate(
                                { id: String(id), versionId: version.id },
                                { onSuccess: () => toast.success(`Restored v${version.version}`), onError: () => toast.error('Could not restore') }
                              )
                            }
                          >
                            <RotateCcw className="h-3 w-3" /> Restore
                          </Button>
                        </div>
                        {openVersion === version.id ? (
                          <pre className="max-h-52 overflow-auto border-t border-border/60 bg-black/30 p-3 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                            {version.script}
                          </pre>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
