import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Receipt, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGetAccounts } from '../hooks/useQueries';
import {
  useAddSplitExpense,
  useAddSplitMember,
  useAddSplitSettlement,
  useCreateSplitGroup,
  useDeleteSplitExpense,
  useDeleteSplitGroup,
  usePostSplitShare,
  useSplitGroup,
  useSplitGroups,
} from '../hooks/useSplits';
import { PageGuide } from '@/components/system/PageGuide';
import { PAGE_HELP } from '@/lib/page-help';

const money = (paise: string | number | null | undefined) => {
  const n = typeof paise === 'string' ? Number(paise) : paise ?? 0;
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.round(Math.abs(n) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const toPaise = (rupees: string) => {
  const value = Number(rupees.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return '0';
  return String(Math.round(value * 100));
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

function Avatar({ name, me }: { name: string; me?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-medium',
        me ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-surface text-muted-foreground'
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function SplitsTab() {
  const { data: groups, isLoading, isError, refetch } = useSplitGroups();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (openGroupId) {
    return <GroupDetailView groupId={openGroupId} onBack={() => setOpenGroupId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Shared money</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Shared expenses</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Split trips, rent and dinners. Every balance is worked out from the expenses themselves, so it is never out of date.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="min-h-11">
          <Plus className="mr-2 h-4 w-4" />
          New group
        </Button>
      </div>

      <PageGuide {...PAGE_HELP.shared} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-panel" />
          ))}
        </div>
      ) : isError ? (
        <div className="panel space-y-3 p-6">
          <p className="text-sm text-muted-foreground">Could not load your groups.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : !groups || groups.length === 0 ? (
        <div className="panel space-y-3 p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Start with the people you share money with</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            A group for your flat, one for the Goa trip. Add who paid, who owes and settle up with a single tap.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="min-h-11">
            Create the first group
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const net = Number(group.myNetPaise);
            return (
              <button
                key={group.id}
                onClick={() => setOpenGroupId(group.id)}
                className="panel group flex min-h-[9rem] flex-col justify-between gap-4 p-5 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden="true">
                        {group.emoji ?? '👥'}
                      </span>
                      <span className="truncate text-base font-semibold text-foreground">{group.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'} · {group.expenseCount}{' '}
                      {group.expenseCount === 1 ? 'expense' : 'expenses'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow">Total shared</p>
                    <p className="font-mono text-sm tabular-nums text-foreground">{money(group.totalPaise)}</p>
                  </div>
                  <div className="text-right">
                    <p className="eyebrow">{net > 0 ? 'Owed to you' : net < 0 ? 'You owe' : 'Settled'}</p>
                    <p
                      className={cn(
                        'font-mono text-sm font-medium tabular-nums',
                        net > 0 ? 'text-success' : net < 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {net === 0 ? '—' : money(group.myNetPaise)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setOpenGroupId} />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [people, setPeople] = useState<string[]>(['']);
  const create = useCreateSplitGroup();

  const reset = () => {
    setName('');
    setEmoji('');
    setPeople(['']);
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Give the group a name');
      return;
    }
    try {
      const group = await create.mutateAsync({
        name: name.trim(),
        emoji: emoji.trim() || undefined,
        members: people.map((person) => person.trim()).filter(Boolean).map((person) => ({ name: person })),
      });
      toast.success(`${group.name} is ready`);
      reset();
      onOpenChange(false);
      onCreated(group.id);
    } catch {
      /* the hook already surfaced the error */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>You are included automatically as “You”.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="w-16">
              <Label htmlFor="split-emoji" className="mb-1 block text-[11px] text-muted-foreground">
                Icon
              </Label>
              <Input
                id="split-emoji"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="🏖"
                maxLength={4}
                className="text-center"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="split-name" className="mb-1 block text-[11px] text-muted-foreground">
                Group name
              </Label>
              <Input
                id="split-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Flat 4B, Goa trip…"
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">People</Label>
            {people.map((person, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={person}
                  onChange={(event) =>
                    setPeople((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                  }
                  placeholder={index === 0 ? 'Aditi, Rohan…' : 'Another person'}
                  aria-label={`Person ${index + 1}`}
                />
                {people.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    aria-label="Remove person"
                    onClick={() => setPeople((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={() => setPeople((c) => [...c, ''])}>
              <Plus className="mr-2 h-4 w-4" />
              Add person
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending} className="min-h-11">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupDetailView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { data: group, isLoading, isError, refetch } = useSplitGroup(groupId);
  const addExpense = useAddSplitExpense();
  const addSettlement = useAddSplitSettlement();
  const deleteExpense = useDeleteSplitExpense();
  const addMember = useAddSplitMember();
  const removeGroup = useDeleteSplitGroup();
  const postShare = usePostSplitShare();
  const { data: accounts } = useGetAccounts();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState('');
  const [participants, setParticipants] = useState<string[] | null>(null);
  const [newMember, setNewMember] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const members = useMemo(() => group?.members ?? [], [group?.members]);
  const selected = participants ?? members.map((member) => member.id);
  const me = useMemo(() => members.find((member) => member.isMe), [members]);

  const perHead = useMemo(() => {
    const total = Number(toPaise(amount));
    if (!selected.length || total <= 0) return 0;
    return Math.floor(total / selected.length);
  }, [amount, selected]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="panel space-y-3 p-6">
        <p className="text-sm text-muted-foreground">This group could not be loaded.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Back to groups
          </Button>
        </div>
      </div>
    );
  }

  const payerId = paidById || group.members.find((member) => member.isMe)?.id || '';

  const handleAddExpense = async () => {
    if (!description.trim()) {
      toast.error('What was this for?');
      return;
    }
    const paise = toPaise(amount);
    if (paise === '0') {
      toast.error('Enter an amount above zero');
      return;
    }
    try {
      await addExpense.mutateAsync({
        groupId,
        description: description.trim(),
        amountPaise: paise,
        paidById: payerId,
        memberIds: selected,
      });
      toast.success('Expense added');
      setDescription('');
      setAmount('');
      setParticipants(null);
    } catch {
      /* handled in the hook */
    }
  };

  const handleSettle = async (transfer: { fromId: string; toId: string; amountPaise: string }) => {
    try {
      await addSettlement.mutateAsync({ groupId, ...transfer, note: 'Settle up' });
      toast.success('Payment recorded');
    } catch {
      /* handled in the hook */
    }
  };

  const handleAddMember = async () => {
    if (!newMember.trim()) return;
    try {
      await addMember.mutateAsync({ groupId, name: newMember.trim() });
      setNewMember('');
      toast.success('Added');
    } catch {
      /* handled in the hook */
    }
  };

  const handlePostShare = async (expenseId: string) => {
    const account = accounts?.find((candidate: any) => candidate.type === 'ASSET');
    if (!account) {
      toast.error('Add a bank or cash account first');
      return;
    }
    try {
      const result = await postShare.mutateAsync({ groupId, expenseId, accountId: account.id });
      toast.success(`Posted ${money(result.amountPaise)} to ${account.name}`);
    } catch {
      /* handled in the hook */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onBack} aria-label="Back to groups">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="eyebrow">Shared money</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              <span className="mr-2" aria-hidden="true">{group.emoji ?? '👥'}</span>
              {group.name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {group.members.length} people · {money(group.totalPaise)} shared
            </p>
          </div>
        </div>
        <Button variant="outline" className="min-h-11 text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete group
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <section className="panel p-5" aria-labelledby="balances-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="balances-heading" className="text-sm font-semibold text-foreground">
                Balances
              </h2>
              <span className="eyebrow">{group.transfers.length} moves to settle</span>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {group.members.map((member) => {
                const net = Number(member.netPaise);
                return (
                  <li key={member.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={member.name} me={member.isMe} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{member.isMe ? 'You' : member.name}</p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        paid {money(member.paidPaise)} · owes {money(member.owedPaise)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-mono text-sm font-medium tabular-nums',
                        net > 0 ? 'text-success' : net < 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {net === 0 ? 'settled' : `${net > 0 ? '+' : '−'}${money(member.netPaise)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {group.transfers.length > 0 ? (
            <section className="panel p-5" aria-labelledby="settle-heading">
              <h2 id="settle-heading" className="text-sm font-semibold text-foreground">
                Settle up
              </h2>
              <ul className="mt-3 space-y-2">
                {group.transfers.map((transfer) => (
                  <li
                    key={`${transfer.fromId}-${transfer.toId}`}
                    className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface px-3 py-2.5"
                  >
                    <span className="text-sm text-foreground">
                      {transfer.fromName} <ArrowRight className="mx-1 inline h-3 w-3" aria-label="pays" />{' '}
                      {transfer.toName}
                    </span>
                    <span className="ml-auto font-mono text-sm tabular-nums text-foreground">
                      {money(transfer.amountPaise)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => handleSettle(transfer)}
                      disabled={addSettlement.isPending}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Record
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="panel p-5" aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-sm font-semibold text-foreground">
              Expenses
            </h2>
            {group.expenses.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing shared yet. Add the first expense on the right.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {group.expenses.map((expense) => {
                  const myShare = expense.shares.find((share) => share.memberId === me?.id);
                  return (
                    <li key={expense.id} className="py-3">
                      <div className="flex items-start gap-3">
                        <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{expense.description}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {expense.paidByName} paid · {day(expense.date)} · split {expense.shares.length} ways
                            {myShare ? ` · your share ${money(myShare.amountPaise)}` : ''}
                          </p>
                        </div>
                        <span className="font-mono text-sm tabular-nums text-foreground">{money(expense.amountPaise)}</span>
                        <div className="flex shrink-0 gap-1">
                          {!expense.transactionId && myShare ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-11"
                              onClick={() => handlePostShare(expense.id)}
                              disabled={postShare.isPending}
                            >
                              Add to books
                            </Button>
                          ) : expense.transactionId ? (
                            <span className="self-center font-mono text-[10px] uppercase tracking-[0.1em] text-success">
                              posted
                            </span>
                          ) : null}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-11 w-11"
                            aria-label={`Delete ${expense.description}`}
                            onClick={() => deleteExpense.mutate({ groupId, expenseId: expense.id })}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel space-y-3 p-5" aria-labelledby="add-expense-heading">
            <h2 id="add-expense-heading" className="text-sm font-semibold text-foreground">
              Add an expense
            </h2>
            <div className="space-y-2">
              <Label htmlFor="split-desc" className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                What for
              </Label>
              <Input
                id="split-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Groceries, cab, dinner…"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="split-amount" className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Amount ₹
                </Label>
                <Input
                  id="split-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="1200"
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Paid by</Label>
                <Select value={payerId} onValueChange={setPaidById}>
                  <SelectTrigger aria-label="Who paid">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {group.members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.isMe ? 'You' : member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Split between</Label>
              <div className="space-y-1.5">
                {group.members.map((member) => (
                  <label
                    key={member.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-panel border border-border px-2.5 py-1.5"
                  >
                    <Checkbox
                      checked={selected.includes(member.id)}
                      onCheckedChange={(checked) =>
                        setParticipants(
                          checked
                            ? [...selected, member.id]
                            : selected.filter((id) => id !== member.id)
                        )
                      }
                    />
                    <span className="text-sm text-foreground">{member.isMe ? 'You' : member.name}</span>
                  </label>
                ))}
              </div>
              {perHead > 0 && (
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {money(perHead)} each across {selected.length}
                </p>
              )}
            </div>
            <Button onClick={handleAddExpense} disabled={addExpense.isPending} className="min-h-11 w-full">
              {addExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add expense
            </Button>
          </section>

          <section className="panel space-y-3 p-5" aria-labelledby="people-heading">
            <h2 id="people-heading" className="text-sm font-semibold text-foreground">
              People
            </h2>
            <div className="flex gap-2">
              <Input
                value={newMember}
                onChange={(event) => setNewMember(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAddMember();
                }}
                placeholder="Name"
                aria-label="New person name"
              />
              <Button variant="outline" className="min-h-11" onClick={handleAddMember} disabled={addMember.isPending}>
                Add
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Someone who is on existing expenses can only be removed once those are deleted.
            </p>
          </section>
        </aside>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {group.name}?</DialogTitle>
            <DialogDescription>
              Every expense, share and settlement in this group is removed. Posted transactions stay in your ledger.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await removeGroup.mutateAsync(groupId);
                setDeleteOpen(false);
                onBack();
              }}
            >
              Delete group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
