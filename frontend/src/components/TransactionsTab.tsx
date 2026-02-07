import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetTransactions, useAddTransaction, useGetAccounts, useAddAccount, useEditTransaction, useDeleteTransaction, Transaction, useGetTransactionsInfinite } from '../hooks/useQueries';
import { Plus, Download, ArrowRight, Trash2, PlusCircle, Edit, Loader2, Calendar as CalendarIcon, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, FileInput } from 'lucide-react';
import { ImportTransactionDialog } from './ImportTransactionDialog';
import { format, isToday, isYesterday } from 'date-fns';

const DEFAULT_CATEGORIES = {
  'ASSET': ['Cash', 'Bank', 'Wallet', 'Receivable', 'Investment', 'Property'],
  'LIABILITY': ['Credit Card', 'Loan', 'Mortgage', 'Payable'],
  'INCOME': ['Salary', 'Freelance', 'Dividend', 'Interest', 'Rental', 'Refund', 'Gift'],
  'EXPENSE': ['Food', 'Groceries', 'Rent', 'Utilities', 'Transportation', 'Entertainment', 'Health', 'Shopping', 'Travel', 'Education', 'Insurance', 'Tax', 'Donation'],
  'EQUITY': ['Opening Balance', 'Capital'],
};

function CreateAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: accounts } = useGetAccounts();
  const addAccount = useAddAccount();
  const [name, setName] = useState('');
  const [type, setType] = useState('EXPENSE');
  const [subType, setSubType] = useState('');
  const [subTypeOpen, setSubTypeOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const existingSubTypes = Array.from(new Set([
    ...(DEFAULT_CATEGORIES[type as keyof typeof DEFAULT_CATEGORIES] || []),
    ...(accounts
      ?.filter(a => a.type === type)
      .map(a => a.subType)
      .filter(Boolean) as string[])
  ]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await addAccount.mutateAsync({ name, type, subType: subType || 'category' });
      toast.success('Account created');
      setName('');
      setSubType('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
          <DialogDescription>Add a new category or account</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Groceries, Salary" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="ASSET">Asset</SelectItem>
                <SelectItem value="LIABILITY">Liability</SelectItem>
                <SelectItem value="EQUITY">Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex flex-col">
            <Label>Sub Type / Category</Label>
            <Popover open={subTypeOpen} onOpenChange={setSubTypeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={subTypeOpen}
                  className="w-full justify-between rounded-xl"
                >
                  {subType || "Select or create sub-type..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 rounded-xl">
                <Command className="rounded-xl">
                  <CommandInput
                    placeholder="Search sub-type..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div className="p-2">
                        <p className="text-sm text-muted-foreground mb-2">No sub-type found.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg"
                          onClick={() => {
                            setSubType(searchValue);
                            setSubTypeOpen(false);
                          }}
                        >
                          Create "{searchValue}"
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup heading="Existing Sub-Types">
                      {existingSubTypes.map((existing) => (
                        <CommandItem
                          key={existing}
                          value={existing}
                          onSelect={() => {
                            setSubType(existing);
                            setSubTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              subType === existing ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {existing}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addAccount.isPending} className="rounded-xl">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionsTab({ initialFilterAccountId }: { initialFilterAccountId?: string }) {
  const { data: accounts } = useGetAccounts();
  const addTransaction = useAddTransaction();
  const editTransaction = useEditTransaction();
  const deleteTransaction = useDeleteTransaction();
  const addAccount = useAddAccount();

  const [open, setOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filters
  const [filterAccountId, setFilterAccountId] = useState<string>(initialFilterAccountId || 'all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [transactionType, setTransactionType] = useState<string>('all');

  useEffect(() => {
    if (initialFilterAccountId) {
      setFilterAccountId(initialFilterAccountId);
    }
  }, [initialFilterAccountId]);

  // Hybrid Query Logic
  const isFiltered = filterAccountId !== 'all' || !!startDate || !!endDate || !!searchQuery || !!minAmount || !!maxAmount || transactionType !== 'all';

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: infiniteLoading
  } = useGetTransactionsInfinite(50, { enabled: !isFiltered });

  const {
    data: allTransactions,
    isLoading: allLoading
  } = useGetTransactions({ limit: -1 }, { enabled: isFiltered });

  const transactionsLoading = isFiltered ? allLoading : infiniteLoading;

  const rawTransactions = isFiltered
    ? (allTransactions || [])
    : (infiniteData?.pages.flatMap((p: any) => p.data) || []);

  const filteredTransactions = useMemo(() => {
    let data = rawTransactions;
    if (isFiltered) {
      data = data.filter((t: Transaction) => {
        // 1. Account Filter
        const matchesAccount = filterAccountId === 'all' || t.splits.some((s: any) => s.accountId.toString() === filterAccountId);

        // 2. Date Filter
        let matchesDate = true;
        const tDate = new Date(t.date).toISOString().split('T')[0];
        if (startDate && endDate) {
          matchesDate = tDate >= startDate && tDate <= endDate;
        } else if (startDate) {
          matchesDate = tDate >= startDate;
        } else if (endDate) {
          matchesDate = tDate <= endDate;
        }

        // 3. Search Filter
        const matchesSearch = !searchQuery || (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());

        // 4. Amount Filter
        const totalAmount = t.splits.reduce((sum: number, split: any) => {
          const amt = Number(split.amount);
          return amt > 0 ? sum + amt : sum;
        }, 0) / 100;

        let matchesAmount = true;
        if (minAmount) matchesAmount = matchesAmount && totalAmount >= parseFloat(minAmount);
        if (maxAmount) matchesAmount = matchesAmount && totalAmount <= parseFloat(maxAmount);

        // 5. Type Filter
        let matchesType = true;
        if (transactionType !== 'all') {
          const hasIncome = t.splits.some((s: any) => s.account?.type === 'INCOME');
          const hasExpense = t.splits.some((s: any) => s.account?.type === 'EXPENSE');

          if (transactionType === 'income') matchesType = hasIncome;
          else if (transactionType === 'expense') matchesType = hasExpense;
          else if (transactionType === 'transfer') matchesType = !hasIncome && !hasExpense;
        }

        return matchesAccount && matchesDate && matchesSearch && matchesAmount && matchesType;
      });
    }
    return data;
  }, [rawTransactions, isFiltered, filterAccountId, startDate, endDate, searchQuery, minAmount, maxAmount, transactionType]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      let key = format(date, 'dd MMM yyyy');
      if (isToday(date)) key = 'Today';
      if (isYesterday(date)) key = 'Yesterday';

      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filteredTransactions]);

  // ... (Rest of the component logic: isInvestmentAccount, handleExport, forms, handlers)
  // I need to copy all the helper functions and state from previous version

  const isInvestmentAccount = (accountId: string) => {
    if (!accountId || !accounts) return false;
    const account = accounts.find(a => a.id.toString() === accountId);
    return account?.type === 'ASSET' && ['mutual-fund', 'stock', 'crypto', 'investment', 'gold', 'bond', 'etf'].includes(account.subType?.toLowerCase() || '');
  };

  const handleExport = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    // ... (Export logic same as before)
    const csvContent = [
      ['Date', 'Description', 'Amount', 'Type', 'Splits'].join(','),
      ...filteredTransactions.map((t: Transaction) => {
        const totalAmount = t.splits.reduce((sum: number, split: any) => {
          const amt = Number(split.amount);
          return amt > 0 ? sum + amt : sum;
        }, 0) / 100;

        const hasIncome = t.splits.some((s: any) => s.account?.type === 'INCOME');
        const hasExpense = t.splits.some((s: any) => s.account?.type === 'EXPENSE');
        let type = 'Transfer';
        if (hasIncome) type = 'Income';
        if (hasExpense) type = 'Expense';

        const splitsStr = t.splits.map((s: any) => `${s.account?.name}: ${Number(s.amount) / 100}`).join('; ');

        return [
          new Date(t.date).toISOString().split('T')[0],
          `"${(t.description || '').replace(/"/g, '""')}"`,
          totalAmount.toFixed(2),
          type,
          `"${splitsStr}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Simple Mode State
  const [simpleForm, setSimpleForm] = useState({
    amount: '',
    fromAccountId: '', // Credit
    toAccountId: '',   // Debit
    description: '',
    date: new Date().toISOString().split('T')[0],
    units: '', // For Investment Accounts
  });

  // Advanced Mode State
  const [advancedSplits, setAdvancedSplits] = useState<{ accountId: string; debit: string; credit: string; units: string }[]>([
    { accountId: '', debit: '', credit: '', units: '' },
    { accountId: '', debit: '', credit: '', units: '' },
  ]);
  const [advancedForm, setAdvancedForm] = useState({
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let splits: { accountId: number; amount: number; units?: number }[] = [];
      let description = '';
      let date = new Date();

      if (mode === 'simple') {
        if (!simpleForm.amount || !simpleForm.fromAccountId || !simpleForm.toAccountId) {
          toast.error('Please fill in all fields');
          return;
        }
        const amount = Math.round(parseFloat(simpleForm.amount) * 100);
        if (isNaN(amount) || amount <= 0) {
          toast.error('Invalid amount');
          return;
        }

        const fromAccount = accounts?.find(a => a.id.toString() === simpleForm.fromAccountId);
        const fromIsInvestment = isInvestmentAccount(simpleForm.fromAccountId);
        const toIsInvestment = isInvestmentAccount(simpleForm.toAccountId);
        const unitsValue = simpleForm.units ? Math.abs(parseFloat(simpleForm.units)) : undefined;

        if (fromIsInvestment && unitsValue) {
          let avgPrice = fromAccount?.averageBuyPrice;
          if (avgPrice !== undefined && avgPrice !== null) {
            const costBasis = Math.round(unitsValue * avgPrice);
            const saleAmount = amount;
            const realizedGain = saleAmount - costBasis;

            splits.push({
              accountId: parseInt(simpleForm.toAccountId),
              amount: saleAmount,
              units: toIsInvestment && unitsValue ? unitsValue : undefined
            });

            splits.push({
              accountId: parseInt(simpleForm.fromAccountId),
              amount: -costBasis,
              units: -unitsValue
            });

            if (realizedGain !== 0) {
              let rglAccount = accounts?.find(a => a.name === 'Realized Gain/Loss');
              if (!rglAccount) {
                try {
                  rglAccount = await addAccount.mutateAsync({
                    name: 'Realized Gain/Loss',
                    type: realizedGain > 0 ? 'INCOME' : 'EXPENSE',
                    subType: 'Investment'
                  });
                } catch (err) {
                  console.error("Failed to create RGL account", err);
                  toast.error("Failed to create Realized Gain/Loss account");
                  return;
                }
              }

              if (rglAccount) {
                splits.push({
                  accountId: rglAccount.id,
                  amount: -realizedGain
                });
              }
            }
          } else {
            splits.push({
              accountId: parseInt(simpleForm.fromAccountId),
              amount: -amount,
              units: fromIsInvestment && unitsValue ? -unitsValue : undefined
            });

            splits.push({
              accountId: parseInt(simpleForm.toAccountId),
              amount: amount,
              units: toIsInvestment && unitsValue ? unitsValue : undefined
            });
          }
        } else {
          splits.push({
            accountId: parseInt(simpleForm.fromAccountId),
            amount: -amount,
            units: fromIsInvestment && unitsValue ? -unitsValue : undefined
          });

          splits.push({
            accountId: parseInt(simpleForm.toAccountId),
            amount: amount,
            units: toIsInvestment && unitsValue ? unitsValue : undefined
          });
        }

        description = simpleForm.description;
        date = new Date(simpleForm.date);
      } else {
        let totalDebit = 0;
        let totalCredit = 0;

        splits = advancedSplits
          .filter(s => s.accountId && (s.debit || s.credit || s.units))
          .map(s => {
            const debit = s.debit ? Math.round(parseFloat(s.debit) * 100) : 0;
            const credit = s.credit ? Math.round(parseFloat(s.credit) * 100) : 0;
            const amount = debit - credit;

            let units = s.units ? parseFloat(s.units) : undefined;

            if (units !== undefined && isInvestmentAccount(s.accountId)) {
              if (amount !== 0) {
                units = Math.sign(amount) * Math.abs(units);
              }
            }

            totalDebit += debit;
            totalCredit += credit;

            return {
              accountId: parseInt(s.accountId),
              amount: amount,
              units: units
            };
          });

        if (splits.length < 2) {
          toast.error('Transaction must have at least 2 splits');
          return;
        }

        if (totalDebit !== totalCredit) {
          toast.error(`Debits (${totalDebit / 100}) must equal Credits (${totalCredit / 100})`);
          return;
        }

        description = advancedForm.description;
        date = new Date(advancedForm.date);
      }

      if (editingId) {
        await editTransaction.mutateAsync({
          id: editingId,
          description,
          date,
          splits,
        });
        toast.success('Transaction updated successfully');
      } else {
        await addTransaction.mutateAsync({
          description,
          date,
          splits,
        });
        toast.success('Transaction added successfully');
      }

      setOpen(false);
      resetForms();
    } catch (error) {
      toast.error(editingId ? 'Failed to update transaction' : 'Failed to add transaction');
    }
  };

  const resetForms = () => {
    setEditingId(null);
    setSimpleForm({
      amount: '',
      fromAccountId: '',
      toAccountId: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      units: '',
    });
    setAdvancedSplits([
      { accountId: '', debit: '', credit: '', units: '' },
      { accountId: '', debit: '', credit: '', units: '' },
    ]);
    setAdvancedForm({
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setMode('simple');
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setMode('advanced');
    setAdvancedForm({
      description: transaction.description,
      date: new Date(transaction.date).toISOString().split('T')[0],
    });

    const splits = transaction.splits.map(s => ({
      accountId: s.accountId.toString(),
      debit: Number(s.amount) > 0 ? (Number(s.amount) / 100).toString() : '',
      credit: Number(s.amount) < 0 ? (Math.abs(Number(s.amount)) / 100).toString() : '',
      units: s.units ? s.units.toString() : '',
    }));

    while (splits.length < 2) {
      splits.push({ accountId: '', debit: '', credit: '', units: '' });
    }

    setAdvancedSplits(splits);
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTransaction.mutateAsync(id);
      toast.success('Transaction deleted');
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForms();
    }
  };

  const addSplit = () => {
    setAdvancedSplits([...advancedSplits, { accountId: '', debit: '', credit: '', units: '' }]);
  };

  const removeSplit = (index: number) => {
    if (advancedSplits.length > 2) {
      const newSplits = [...advancedSplits];
      newSplits.splice(index, 1);
      setAdvancedSplits(newSplits);
    }
  };

  const updateSplit = (index: number, field: 'accountId' | 'debit' | 'credit' | 'units', value: string) => {
    const newSplits = [...advancedSplits];
    newSplits[index] = { ...newSplits[index], [field]: value };

    if (field === 'debit' && value) newSplits[index].credit = '';
    if (field === 'credit' && value) newSplits[index].debit = '';

    setAdvancedSplits(newSplits);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (transactionsLoading && !hasNextPage && !isFiltered) { // Only show full skeleton if initial load
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const showSimpleUnitsInput = isInvestmentAccount(simpleForm.fromAccountId) || isInvestmentAccount(simpleForm.toAccountId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
          <p className="text-muted-foreground">Double-entry ledger of all transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl" onClick={() => setImportOpen(true)}>
            <FileInput className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card border-0 rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 rounded-xl bg-background/50 border-white/10"
              />
            </div>
            <Select value={filterAccountId} onValueChange={setFilterAccountId}>
              <SelectTrigger className="rounded-xl bg-background/50 border-white/10">
                <SelectValue placeholder="Filter by Account" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts?.map((acc: any) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={transactionType} onValueChange={setTransactionType}>
              <SelectTrigger className="rounded-xl bg-background/50 border-white/10">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl bg-background/50 border-white/10" />
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl bg-background/50 border-white/10" />
            </div>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min ₹" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="rounded-xl bg-background/50 border-white/10" />
              <Input type="number" placeholder="Max ₹" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="rounded-xl bg-background/50 border-white/10" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {Object.entries(groupedTransactions).map(([date, txs]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-muted-foreground">{date}</h3>
            </div>
            <div className="grid gap-3">
              {txs.map((t: Transaction) => {
                const totalAmount = t.splits.reduce((sum: number, split: any) => {
                  const amt = Number(split.amount);
                  return amt > 0 ? sum + amt : sum;
                }, 0) / 100;

                const hasIncome = t.splits.some((s: any) => s.account?.type === 'INCOME');
                const hasExpense = t.splits.some((s: any) => s.account?.type === 'EXPENSE');
                let typeColor = 'text-blue-500';
                if (hasIncome) typeColor = 'text-emerald-500';
                if (hasExpense) typeColor = 'text-rose-500';

                return (
                  <div key={t.id} className="group flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-background/40 hover:bg-background/60 hover:border-primary/20 transition-all duration-300 shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full bg-background/50 border border-white/10 group-hover:scale-110 transition-transform duration-300`}>
                        {hasIncome ? <Plus className="h-5 w-5 text-emerald-500" /> : hasExpense ? <ArrowRight className="h-5 w-5 text-rose-500" /> : <ChevronsUpDown className="h-5 w-5 text-blue-500" />}
                      </div>
                      <div>
                        <p className="font-medium text-lg">{t.description}</p>
                        <div className="flex gap-2 text-sm text-muted-foreground mt-1">
                          {t.splits.slice(0, 2).map((s: any, i: number) => (
                            <span key={i} className="bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                              {s.account?.name}
                            </span>
                          ))}
                          {t.splits.length > 2 && <span className="text-xs self-center">+{t.splits.length - 2} more</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className={`text-xl font-bold ${typeColor}`}>
                        {formatCurrency(totalAmount)}
                      </div>
                      <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full hover:bg-primary/20" onClick={() => handleEdit(t)}>
                          <Edit className="h-5 w-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full hover:bg-destructive/20 text-destructive" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredTransactions.length === 0 && !transactionsLoading && (
          <div className="text-center py-20 text-muted-foreground">
            <p>No transactions found.</p>
          </div>
        )}

        {!isFiltered && hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-full px-8 border-primary/20 hover:bg-primary/10 hover:text-primary"
            >
              {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogTrigger asChild>
          <Button className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white p-0 md:hidden z-50">
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update transaction details' : 'Record a new transaction'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="simple" className="w-full" value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
            <TabsList className="bg-background/50 backdrop-blur-md border border-white/10 h-12 p-1 rounded-full shadow-sm grid w-full grid-cols-2 mt-4">
              <TabsTrigger value="simple" className="rounded-full h-full text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">Simple Transfer</TabsTrigger>
              <TabsTrigger value="advanced" className="rounded-full h-full text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300">Advanced (Splits)</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit}>
              <TabsContent value="simple" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={simpleForm.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimpleForm({ ...simpleForm, date: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={simpleForm.amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimpleForm({ ...simpleForm, amount: e.target.value })}
                    className="rounded-xl text-lg font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>From (Credit)</Label>
                    <div className="flex gap-2">
                      <Select value={simpleForm.fromAccountId} onValueChange={(v: string) => setSimpleForm({ ...simpleForm, fromAccountId: v })}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Source Account" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {accounts?.map((acc: any) => (
                            <SelectItem key={acc.id} value={acc.id.toString()}>
                              {acc.name} ({acc.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setCreateAccountOpen(true)} className="rounded-xl">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-center pb-3">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label>To (Debit)</Label>
                    <div className="flex gap-2">
                      <Select value={simpleForm.toAccountId} onValueChange={(v: string) => setSimpleForm({ ...simpleForm, toAccountId: v })}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Destination Account" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {accounts?.map((acc: any) => (
                            <SelectItem key={acc.id} value={acc.id.toString()}>
                              {acc.name} ({acc.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setCreateAccountOpen(true)} className="rounded-xl">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {showSimpleUnitsInput && (
                  <div className="space-y-2 bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                    <Label className="text-blue-400">Investment Units (Purchased/Sold)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      value={simpleForm.units}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimpleForm({ ...simpleForm, units: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="What is this for?"
                    value={simpleForm.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimpleForm({ ...simpleForm, description: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={advancedForm.date}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdvancedForm({ ...advancedForm, date: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Transaction description"
                      value={advancedForm.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdvancedForm({ ...advancedForm, description: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Splits</Label>
                  <div className="space-y-2">
                    {advancedSplits.map((split, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1 flex gap-2">
                          <Select value={split.accountId} onValueChange={(v: string) => updateSplit(index, 'accountId', v)}>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Account" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {accounts?.map((acc: any) => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                  {acc.name} ({acc.type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => setCreateAccountOpen(true)} className="rounded-xl">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {isInvestmentAccount(split.accountId) && (
                          <div className="w-24">
                            <Input
                              placeholder="Units"
                              type="number"
                              step="0.0001"
                              value={split.units}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSplit(index, 'units', e.target.value)}
                              className="rounded-xl"
                            />
                          </div>
                        )}

                        <div className="w-24">
                          <Input
                            placeholder="Debit"
                            type="number"
                            value={split.debit}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSplit(index, 'debit', e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            placeholder="Credit"
                            type="number"
                            value={split.credit}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSplit(index, 'credit', e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSplit(index)}
                          className="rounded-xl hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" onClick={addSplit} className="w-full rounded-xl border-dashed">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Split
                  </Button>
                </div>
              </TabsContent>

              <DialogFooter>
                <Button type="submit" className="rounded-xl w-full md:w-auto">
                  {editingId ? 'Update Transaction' : 'Create Transaction'}
                </Button>
              </DialogFooter>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CreateAccountDialog open={createAccountOpen} onOpenChange={setCreateAccountOpen} />
      <ImportTransactionDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
