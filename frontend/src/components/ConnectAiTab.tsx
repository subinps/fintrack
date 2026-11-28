import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatINR } from '../lib/finance';
import { useGetAccounts } from '../hooks/useQueries';
import {
  useBulkTransactionAction,
  useCreateMcpToken,
  useDraftTransactions,
  useMcpAudit,
  useMcpSetup,
  useMcpTokens,
  useRevokeMcpToken,
  type McpWriteMode,
  type McpToken,
  type McpTokenCreated,
} from '../hooks/useMcp';
import { ErrorState, SectionHeading, SkeletonBlock } from './overview/primitives';

type Panel = 'keys' | 'drafts' | 'activity';

const dateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

const relative = (iso: string | null) => {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

const statusStyles: Record<string, string> = {
  OK: 'text-success border-success/30 bg-success/10',
  DENIED: 'text-warning border-warning/30 bg-warning/10',
  ERROR: 'text-destructive border-destructive/30 bg-destructive/10',
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error('Could not copy — select the text instead');
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: accounts } = useGetAccounts();
  const create = useCreateMcpToken();
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('90');
  const [writeMode, setWriteMode] = useState<McpWriteMode>('DRAFT');
  const [canWrite, setCanWrite] = useState(true);
  const [allowList, setAllowList] = useState<number[]>([]);
  const [created, setCreated] = useState<McpTokenCreated | null>(null);

  const reset = () => {
    setName('');
    setExpiry('90');
    setWriteMode('DRAFT');
    setCanWrite(true);
    setAllowList([]);
    setCreated(null);
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error('Give the key a name so you can recognise it later');
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        scopes: canWrite ? ['read', 'write:transactions'] : ['read'],
        writeMode,
        expiresInDays: expiry === 'never' ? null : Number(expiry),
        accountAllowList: allowList,
      },
      {
        onSuccess: (data) => {
          setCreated(data);
          toast.success('Key created — copy it now, it is shown once');
        },
        onError: () => toast.error('Could not create the key'),
      }
    );
  };

  const snippet = useMemo(() => {
    if (!created) return '';
    const config = created.setup.claudeDesktop;
    return typeof config === 'string' ? config : JSON.stringify(config, null, 2);
  }, [created]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Key ready
              </DialogTitle>
              <DialogDescription>
                This is the only time the secret is shown. Paste it into your AI client now.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="eyebrow">Secret</p>
                <code className="mono mt-1 block break-all text-[12px] leading-relaxed text-foreground">{created.token}</code>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">Claude Desktop / Cursor config</p>
                  <CopyButton value={snippet} label="Copy JSON" />
                </div>
                <pre className="mono max-h-52 overflow-auto rounded-xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
                  {snippet}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">Claude Code</p>
                  <CopyButton value={created.setup.claudeCode} label="Copy command" />
                </div>
                <pre className="mono overflow-x-auto rounded-xl border border-border bg-muted/40 p-3 text-[11px]">
                  {created.setup.claudeCode}
                </pre>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> New access key
              </DialogTitle>
              <DialogDescription>
                Keys let Claude, Cursor or any MCP client read your ledger and post entries on your behalf.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Claude Desktop"
                  autoFocus
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Expires</Label>
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger aria-label="Expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">In 30 days</SelectItem>
                      <SelectItem value="90">In 90 days</SelectItem>
                      <SelectItem value="365">In a year</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>When AI posts a transaction</Label>
                  <Select value={writeMode} onValueChange={(value) => setWriteMode(value as McpWriteMode)}>
                    <SelectTrigger aria-label="Write mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Save as draft for me to approve</SelectItem>
                      <SelectItem value="DIRECT">Post straight to the ledger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCanWrite((value) => !value)}
                className="flex w-full items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left transition-colors hover:border-primary/40"
                aria-pressed={canWrite}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    canWrite ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  )}
                >
                  {canWrite ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-medium">Allow writing</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    Without this the key is read-only: balances, reports and budgets only.
                  </span>
                </span>
              </button>
              {accounts?.length ? (
                <div className="space-y-2">
                  <Label>Limit to accounts (optional)</Label>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border p-2">
                    {accounts.map((account) => {
                      const on = allowList.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setAllowList((prev) =>
                              prev.includes(account.id) ? prev.filter((id) => id !== account.id) : [...prev, account.id]
                            )
                          }
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                            on
                              ? 'border-primary/50 bg-primary/15 text-foreground'
                              : 'border-border text-muted-foreground hover:border-primary/30'
                          )}
                        >
                          {account.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Leave empty to allow every account.
                  </p>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={create.isPending} className="gap-2">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Create key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeyCard({ token, onRevoke }: { token: McpToken; onRevoke: () => void }) {
  const revoked = Boolean(token.revokedAt);
  const expired = token.expiresAt ? new Date(token.expiresAt).getTime() < Date.now() : false;
  const dead = revoked || expired;
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
        dead ? 'border-border/60 bg-muted/20' : 'border-border bg-card/40 hover:border-primary/30'
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{token.name}</p>
          <span className="mono rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            {token.prefix}…
          </span>
          {revoked ? (
            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-destructive">
              Revoked
            </span>
          ) : expired ? (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-warning">
              Expired
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{token.scopes.includes('write:transactions') ? (token.writeMode === 'DRAFT' ? 'Read + write as drafts' : 'Read + write direct') : 'Read only'}</span>
          <span aria-hidden="true">·</span>
          <span>Used {relative(token.lastUsedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{token.expiresAt ? `Expires ${dateTime(token.expiresAt)}` : 'No expiry'}</span>
          {token.accountAllowList.length ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{token.accountAllowList.length} account{token.accountAllowList.length === 1 ? '' : 's'} allowed</span>
            </>
          ) : null}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 shrink-0 gap-2 text-muted-foreground hover:text-destructive"
        onClick={onRevoke}
        disabled={dead}
      >
        <Trash2 className="h-3.5 w-3.5" /> Revoke
      </Button>
    </div>
  );
}

export function ConnectAiTab() {
  const [panel, setPanel] = useState<Panel>('keys');
  const [createOpen, setCreateOpen] = useState(false);
  const tokens = useMcpTokens();
  const setup = useMcpSetup();
  const audit = useMcpAudit();
  const drafts = useDraftTransactions();
  const revoke = useRevokeMcpToken();
  const bulk = useBulkTransactionAction();

  const active = tokens.data?.filter((token) => !token.revokedAt) ?? [];
  const readTools = setup.data?.tools.filter((tool) => tool.access === 'read').length ?? 0;
  const writeTools = setup.data?.tools.filter((tool) => tool.access === 'write:transactions').length ?? 0;

  const total = (splits: { amount: string; account?: { type: string } }[]) =>
    splits
      .filter((split) => split.account?.type === 'EXPENSE')
      .reduce((sum, split) => sum + Number(split.amount), 0);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="AI access"
        title="Connect to AI"
        description="Hand your ledger to Claude, Cursor or any MCP client. Every call is logged, writes can land as drafts, and each key can be revoked in one tap."
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New key
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel space-y-4 p-5">
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {(
              [
                ['keys', 'Keys', active.length],
                ['drafts', 'Drafts', drafts.data?.length ?? 0],
                ['activity', 'Activity', null],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPanel(id)}
                aria-pressed={panel === id}
                className={cn(
                  'flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm transition-colors',
                  panel === id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
                {count ? (
                  <span className="mono rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{count}</span>
                ) : null}
              </button>
            ))}
          </div>

          {panel === 'keys' ? (
            tokens.isLoading ? (
              <div className="space-y-2">
                <SkeletonBlock className="h-20" />
                <SkeletonBlock className="h-20" />
              </div>
            ) : tokens.isError ? (
              <ErrorState title="Could not load keys" onRetry={() => tokens.refetch()} />
            ) : tokens.data?.length ? (
              <div className="space-y-2">
                {tokens.data.map((token) => (
                  <KeyCard
                    key={token.id}
                    token={token}
                    onRevoke={() =>
                      revoke.mutate(token.id, {
                        onSuccess: () => toast.success(`${token.name} revoked`),
                        onError: () => toast.error('Could not revoke that key'),
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <KeyRound className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No keys yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Create a key and ask Claude “how much did I spend on food this month?” — it reads straight from your ledger.
                </p>
                <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" /> Create the first key
                </Button>
              </div>
            )
          ) : null}

          {panel === 'drafts' ? (
            drafts.isLoading ? (
              <div className="space-y-2">
                <SkeletonBlock className="h-16" />
                <SkeletonBlock className="h-16" />
              </div>
            ) : drafts.isError ? (
              <ErrorState title="Could not load drafts" onRetry={() => drafts.refetch()} />
            ) : drafts.data?.length ? (
              <ul className="space-y-2">
                {drafts.data.map((draft) => (
                  <li
                    key={draft.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{draft.description}</p>
                      <p className="mono mt-1 text-[11px] text-muted-foreground">
                        {new Date(draft.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {draft.splits.length} splits · {formatINR(total(draft.splits))}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        className="h-9 gap-1.5"
                        disabled={bulk.isPending}
                        onClick={() =>
                          bulk.mutate(
                            { ids: [draft.id], action: 'approve' },
                            {
                              onSuccess: () => toast.success('Draft approved and posted'),
                              onError: () => toast.error('Could not approve that draft'),
                            }
                          )
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={bulk.isPending}
                        onClick={() =>
                          bulk.mutate(
                            { ids: [draft.id], action: 'void' },
                            {
                              onSuccess: () => toast.success('Draft rejected'),
                              onError: () => toast.error('Could not reject that draft'),
                            }
                          )
                        }
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
                <p className="mt-3 text-sm font-medium">Inbox zero</p>
                <p className="mt-1 text-xs text-muted-foreground">Drafts posted by AI keys land here for your approval.</p>
              </div>
            )
          ) : null}

          {panel === 'activity' ? (
            audit.isLoading ? (
              <SkeletonBlock className="h-48" />
            ) : audit.isError ? (
              <ErrorState title="Could not load activity" onRetry={() => audit.refetch()} />
            ) : audit.data?.length ? (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="eyebrow px-2 pb-2">Tool</th>
                      <th className="eyebrow px-2 pb-2">Key</th>
                      <th className="eyebrow px-2 pb-2">Status</th>
                      <th className="eyebrow px-2 pb-2 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data.map((entry) => (
                      <tr key={entry.id} className="border-t border-border/70">
                        <td className="px-2 py-2.5">
                          <p className="mono text-[12px]">{entry.tool}</p>
                          {entry.summary ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{entry.summary}</p>
                          ) : null}
                          {entry.error ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-destructive">{entry.error}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-muted-foreground">{entry.tokenName ?? '—'}</td>
                        <td className="px-2 py-2.5">
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]',
                              statusStyles[entry.status] ?? 'border-border text-muted-foreground'
                            )}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="mono px-2 py-2.5 text-right text-[11px] text-muted-foreground">
                          {relative(entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <Clock3 className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No calls yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Every tool call from your AI client shows up here.</p>
              </div>
            )
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="panel space-y-3 p-5">
            <p className="eyebrow">Endpoint</p>
            {setup.isLoading ? (
              <SkeletonBlock className="h-9" />
            ) : setup.isError ? (
              <ErrorState title="Could not load setup" onRetry={() => setup.refetch()} />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <code className="mono min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-[11px]">
                    {setup.data?.url}
                  </code>
                  <CopyButton value={setup.data?.url ?? ''} label="Copy" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-muted/30 px-2 py-2.5">
                    <p className="mono text-lg tabular-nums">{readTools}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Read tools</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-2 py-2.5">
                    <p className="mono text-lg tabular-nums">{writeTools}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Write tools</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="panel space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <p className="eyebrow">Three steps</p>
            </div>
            <ol className="space-y-3">
              {[
                ['Create a key', 'Pick read-only or let it post drafts you approve.'],
                ['Paste the config', 'Drop the JSON into Claude Desktop or run the Claude Code command.'],
                ['Ask in plain words', '“Move ₹2,000 from savings to rent” arrives as a draft.'],
              ].map(([title, body], index) => (
                <li key={title} className="flex gap-3">
                  <span className="mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[10px] text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-warning/25 bg-warning/[0.06] p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <p className="text-xs font-medium">Keys are passwords</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Revoke a key the moment you stop using a client. Revoked keys fail on the next call.
            </p>
          </div>
        </aside>
      </div>

      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
