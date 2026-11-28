import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetAccounts, useAddTransaction, useEditTransaction, useAddAccount, useTransactionTags, Transaction } from '../hooks/useQueries';
import { Plus, Trash2, PlusCircle, ArrowRight, ChevronsUpDown, Check } from 'lucide-react';
import { TagEditor } from './TagEditor';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface TransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transaction?: Transaction | null;
    onSuccess?: () => void;
}

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
            .filter(Boolean) as string[] || [])
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Account</DialogTitle>
                    <DialogDescription>Add a new category or account</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Groceries, Salary" />
                    </div>
                    <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
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
                                    className="w-full justify-between"
                                >
                                    {subType || "Select or create sub-type..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
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
                                                    className="w-full"
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
                        <Button type="submit" disabled={addAccount.isPending}>Create</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function TransactionDialog({ open, onOpenChange, transaction, onSuccess }: TransactionDialogProps) {
    const { data: accounts } = useGetAccounts();
    const { data: knownTags } = useTransactionTags();
    const addTransaction = useAddTransaction();
    const editTransaction = useEditTransaction();
    const addAccount = useAddAccount();

    const [createAccountOpen, setCreateAccountOpen] = useState(false);
    const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
    const [tagInput, setTagInput] = useState('');
    const tagList = useMemo(
        () => tagInput.split(',').map((tag) => tag.trim()).filter(Boolean),
        [tagInput]
    );
    const tagSuggestions = useMemo(() => (knownTags ?? []).map((tag) => tag.name), [knownTags]);

    // Simple Mode State
    const [simpleForm, setSimpleForm] = useState({
        amount: '',
        fromAccountId: '',
        toAccountId: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        units: '',
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

    useEffect(() => {
        if (open) {
            if (transaction) {
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
                setTagInput(((transaction.tags as string[] | undefined) ?? []).join(', '));
            } else {
                resetForms();
            }
        }
    }, [open, transaction]);

    const resetForms = () => {
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
        setTagInput('');
        setMode('simple');
    };

    const isInvestmentAccount = (accountId: string) => {
        if (!accountId || !accounts) return false;
        const account = accounts.find(a => a.id.toString() === accountId);
        return account?.type === 'ASSET' && ['mutual-fund', 'stock', 'crypto', 'investment', 'gold', 'bond', 'etf'].includes(account.subType?.toLowerCase() || '');
    };

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
                    const avgPrice = fromAccount?.averageBuyPrice;

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

            const parsedTags = tagInput
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);

            if (transaction) {
                await editTransaction.mutateAsync({
                    id: transaction.id,
                    description,
                    date,
                    splits,
                    tags: parsedTags,
                });
                toast.success('Transaction updated successfully');
            } else {
                await addTransaction.mutateAsync({
                    description,
                    date,
                    splits,
                    tags: parsedTags,
                });
                toast.success('Transaction added successfully');
            }

            onOpenChange(false);
            resetForms();
            onSuccess?.();
        } catch (error) {
            toast.error(transaction ? 'Failed to update transaction' : 'Failed to add transaction');
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

    const showSimpleUnitsInput = isInvestmentAccount(simpleForm.fromAccountId) || isInvestmentAccount(simpleForm.toAccountId);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) resetForms();
        }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{transaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
                    <DialogDescription>Record a financial transaction</DialogDescription>
                </DialogHeader>

                <Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="simple" disabled={!!transaction}>Simple Transfer</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced (Splits)</TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleSubmit}>
                        <TabsContent value="simple" className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={simpleForm.date}
                                        onChange={(e) => setSimpleForm({ ...simpleForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Amount (₹)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={simpleForm.amount}
                                        onChange={(e) => setSimpleForm({ ...simpleForm, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label>From (Credit)</Label>
                                    <div className="flex gap-2">
                                        <Select value={simpleForm.fromAccountId} onValueChange={(v) => setSimpleForm({ ...simpleForm, fromAccountId: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pick account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts?.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id.toString()}>
                                                        {acc.name} ({acc.type})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" variant="outline" size="icon" onClick={() => setCreateAccountOpen(true)}>
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
                                        <Select value={simpleForm.toAccountId} onValueChange={(v) => setSimpleForm({ ...simpleForm, toAccountId: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pick account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts?.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id.toString()}>
                                                        {acc.name} ({acc.type})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" variant="outline" size="icon" onClick={() => setCreateAccountOpen(true)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {showSimpleUnitsInput && (
                                <div className="space-y-2 bg-primary/10 p-4 rounded-lg border border-primary/20">
                                    <Label className="text-primary">Investment Units (Purchased/Sold)</Label>
                                    <Input
                                        type="number"
                                        step="0.0001"
                                        placeholder="0.00"
                                        value={simpleForm.units}
                                        onChange={(e) => setSimpleForm({ ...simpleForm, units: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input
                                    placeholder="What is this for?"
                                    value={simpleForm.description}
                                    onChange={(e) => setSimpleForm({ ...simpleForm, description: e.target.value })}
                                />
                            </div>

                            <TagEditor
                                id="transaction-tags-simple"
                                tags={tagList}
                                onChange={(tags) => setTagInput(tags.join(', '))}
                                suggestions={tagSuggestions}
                            />
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={advancedForm.date}
                                        onChange={(e) => setAdvancedForm({ ...advancedForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input
                                        placeholder="Transaction description"
                                        value={advancedForm.description}
                                        onChange={(e) => setAdvancedForm({ ...advancedForm, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <TagEditor
                                id="transaction-tags-advanced"
                                tags={tagList}
                                onChange={(tags) => setTagInput(tags.join(', '))}
                                suggestions={tagSuggestions}
                            />

                            <div className="space-y-2">
                                <Label>Splits</Label>
                                <div className="space-y-2">
                                    {advancedSplits.map((split, index) => (
                                        <div key={index} className="flex gap-2 items-end">
                                            <div className="flex-1 flex gap-2">
                                                <Select value={split.accountId} onValueChange={(v) => updateSplit(index, 'accountId', v)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Account" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {accounts?.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id.toString()}>
                                                                {acc.name} ({acc.type})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button type="button" variant="outline" size="icon" onClick={() => setCreateAccountOpen(true)}>
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
                                                        onChange={(e) => updateSplit(index, 'units', e.target.value)}
                                                    />
                                                </div>
                                            )}

                                            <div className="w-24">
                                                <Input
                                                    placeholder="Debit"
                                                    type="number"
                                                    value={split.debit}
                                                    onChange={(e) => updateSplit(index, 'debit', e.target.value)}
                                                />
                                            </div>
                                            <div className="w-24">
                                                <Input
                                                    placeholder="Credit"
                                                    type="number"
                                                    value={split.credit}
                                                    onChange={(e) => updateSplit(index, 'credit', e.target.value)}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeSplit(index)}
                                                disabled={advancedSplits.length <= 2}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addSplit} className="mt-2">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Split
                                </Button>
                            </div>
                        </TabsContent>

                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={addTransaction.isPending || editTransaction.isPending}>
                                {editTransaction.isPending || addTransaction.isPending ? 'Saving...' : (transaction ? 'Update Transaction' : 'Save Transaction')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Tabs>
            </DialogContent>
            <CreateAccountDialog open={createAccountOpen} onOpenChange={setCreateAccountOpen} />
        </Dialog>
    );
}
