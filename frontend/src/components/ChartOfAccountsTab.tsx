import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetAccounts, useAddAccount, useEditAccount, useDeleteAccount } from '../hooks/useQueries';
import { Plus, Edit, Trash2, Building2, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Check, ChevronsUpDown, Download, FileSpreadsheet, Search, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Account } from '../hooks/useQueries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useGetCategories, useAddCategory, useEditCategory, useDeleteCategory } from '../hooks/useQueries';
import { ScrollArea } from './ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LedgerViewDialog } from './LedgerViewDialog';
import api from '../lib/api';

function CategoryManager() {
    const { data: categories, isLoading } = useGetCategories();
    const { data: accounts } = useGetAccounts();
    const addCategory = useAddCategory();
    const editCategory = useEditCategory();
    const deleteCategory = useDeleteCategory();
    const [newCategory, setNewCategory] = useState('');
    const [selectedType, setSelectedType] = useState('ASSET');
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAdd = async () => {
        if (!newCategory.trim()) return;
        try {
            await addCategory.mutateAsync({ name: newCategory.trim(), type: selectedType });
            setNewCategory('');
            toast.success('Category added');
        } catch (error) {
            toast.error('Failed to add category');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteCategory.mutateAsync(id);
            toast.success('Category deleted');
        } catch (error) {
            toast.error('Failed to delete category');
        }
    };

    const startEdit = (id: number, name: string) => {
        setEditingId(id);
        setEditingName(name);
    };

    const saveEdit = async () => {
        if (editingId === null || !editingName.trim()) return;
        try {
            await editCategory.mutateAsync({ id: editingId, name: editingName.trim() });
            toast.success('Category updated');
            setEditingId(null);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to update category');
        }
    };

    const usage = useMemo(() => {
        const counts = new Map<string, number>();
        for (const account of accounts || []) {
            if (!account.subType) continue;
            const key = `${account.type}:${account.subType}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        return counts;
    }, [accounts]);

    const filteredCategories = (categories || []).filter(
        (c) => c.type === selectedType && (!search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase())),
    );

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap gap-2">
                {['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'].map(type => (
                    <Button
                        key={type}
                        variant={selectedType === type ? 'default' : 'outline'}
                        size="sm"
                        className="shrink-0"
                        onClick={() => { setSelectedType(type); setEditingId(null); }}
                    >
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                    </Button>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    placeholder={`New ${selectedType.toLowerCase()} category...`}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd} disabled={addCategory.isPending} className="shrink-0">Add</Button>
            </div>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter categories" className="pl-9" />
            </div>
            <div className="flex-1 overflow-hidden rounded-md border">
                <ScrollArea className="h-[300px]">
                    {isLoading ? (
                        <div className="space-y-2 p-3">
                            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-full" />)}
                        </div>
                    ) : filteredCategories.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                            {search.trim() ? `No ${selectedType.toLowerCase()} categories match "${search.trim()}".` : `No ${selectedType.toLowerCase()} categories yet — add one above.`}
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {filteredCategories.map(cat => {
                                const used = usage.get(`${cat.type}:${cat.name}`) || 0;
                                const isEditing = editingId === cat.id;
                                return (
                                    <li key={cat.id} className="flex min-h-11 items-center gap-2 px-3 py-1.5">
                                        {isEditing ? (
                                            <>
                                                <Input
                                                    autoFocus
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveEdit();
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                    className="h-9 min-w-0"
                                                    aria-label={`Rename ${cat.name}`}
                                                />
                                                <Button size="sm" className="shrink-0" onClick={saveEdit} disabled={editCategory.isPending} aria-label={`Save ${cat.name}`}>
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setEditingId(null)}>Cancel</Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="min-w-0 flex-1 truncate text-sm">{cat.name}</span>
                                                <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                                                    {used > 0 ? `${used} account${used === 1 ? '' : 's'}` : 'unused'}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 shrink-0"
                                                    aria-label={`Edit ${cat.name}`}
                                                    onClick={() => startEdit(cat.id, cat.name)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 shrink-0 text-destructive"
                                                            aria-label={`Delete ${cat.name}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                It disappears from pickers, filters and reports.
                                                                {used > 0
                                                                    ? ` ${used} account${used === 1 ? '' : 's'} still use it and keep the label.`
                                                                    : ' No account is using it.'}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(cat.id)}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </ScrollArea>
            </div>
            <p className="text-[11px] text-muted-foreground">
                Renaming a category renames the accounts that use it, so pickers and reports stay in step. Delete only removes the label; accounts keep theirs.
            </p>
        </div>
    );
}

const DEFAULT_CATEGORIES = {
    'ASSET': [
        'Savings', 'Current', 'Wallet', 'Cash',
        'Stock', 'Mutual Fund', 'Crypto', 'ETF', 'Bond', 'Other Investment',
        'Receivable', 'Property', 'Vehicle', 'Gold', 'Other Asset'
    ],
    'LIABILITY': [
        'Credit Card', 'Loan', 'Mortgage', 'Payable', 'Overdraft', 'Other Liability'
    ],
    'INCOME': [
        'Salary', 'Freelance', 'Business', 'Dividend', 'Interest', 'Rental', 'Refund', 'Gift', 'Bonus', 'Grant', 'Other Income'
    ],
    'EXPENSE': [
        'Food', 'Groceries', 'Rent', 'Utilities', 'Transportation', 'Entertainment', 'Health', 'Shopping', 'Travel',
        'Education', 'Insurance', 'Tax', 'Donation', 'Subscriptions', 'Personal Care', 'Home', 'Kids', 'Pets', 'Other Expense'
    ],
    'EQUITY': ['Opening Balance', 'Capital', 'Retained Earnings'],
};

export function ChartOfAccountsTab() {
    const { data: accounts, isLoading } = useGetAccounts();
    const addAccount = useAddAccount();
    const editAccount = useEditAccount();
    const deleteAccount = useDeleteAccount();

    const [open, setOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'ASSET',
        subType: '',
        openingBalance: '',
    });
    const [subTypeOpen, setSubTypeOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Ledger Dialog State
    const [ledgerDialog, setLedgerDialog] = useState<{ open: boolean; accountId: number | null; accountName: string }>({
        open: false,
        accountId: null,
        accountName: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.type) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            if (editMode && editingAccount) {
                await editAccount.mutateAsync({
                    id: editingAccount.id,
                    name: formData.name,
                    type: formData.type,
                    subType: formData.subType,
                });
                toast.success('Account updated successfully');
            } else {
                await addAccount.mutateAsync({
                    name: formData.name,
                    type: formData.type,
                    subType: formData.subType,
                    openingBalance: formData.openingBalance,
                });
                toast.success('Account created successfully');
            }
            setOpen(false);
            resetForm();
        } catch (error) {
            toast.error(editMode ? 'Failed to update account' : 'Failed to create account');
        }
    };

    const resetForm = () => {
        setEditMode(false);
        setEditingAccount(null);
        setFormData({ name: '', type: 'ASSET', subType: '', openingBalance: '' });
    };

    const handleEdit = (account: Account) => {
        setEditingAccount(account);
        setEditMode(true);
        setFormData({
            name: account.name,
            type: account.type,
            subType: account.subType || '',
            openingBalance: '', // Cannot easily edit opening balance
        });
        setOpen(true);
    };

    const handleDelete = async (accountId: number) => {
        try {
            await deleteAccount.mutateAsync(accountId);
            toast.success('Account deleted successfully');
        } catch (error) {
            toast.error('Failed to delete account. It may have transactions.');
        }
    };

    const handleExportLedger = async (accountId: number, accountName: string) => {
        try {
            const response = await api.get(`/accounts/${accountId}/export`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ledger_${accountName.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Ledger exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export ledger');
        }
    };

    const handleExport = () => {
        if (!accounts) return;

        const headers = ['ID', 'Name', 'Type', 'Sub Type', 'Balance'];
        const csvContent = [
            headers.join(','),
            ...accounts.map(acc => [
                acc.id,
                `"${acc.name}"`,
                acc.type,
                acc.subType || '',
                (Number(acc.balance) / 100).toFixed(2)
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chart_of_accounts_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

    const getIcon = (type: string) => {
        switch (type) {
            case 'ASSET': return <Wallet className="h-4 w-4" />;
            case 'LIABILITY': return <TrendingDown className="h-4 w-4" />;
            case 'EQUITY': return <Building2 className="h-4 w-4" />;
            case 'INCOME': return <TrendingUp className="h-4 w-4" />;
            case 'EXPENSE': return <ArrowRightLeft className="h-4 w-4" />;
            default: return <Wallet className="h-4 w-4" />;
        }
    };

    const { data: dynamicCategories } = useGetCategories();

    // Get unique subTypes for the current selected type in the form
    const existingSubTypes = useMemo(() => Array.from(new Set([
        ...(DEFAULT_CATEGORIES[formData.type as keyof typeof DEFAULT_CATEGORIES] || []),
        ...(accounts
            ?.filter(a => a.type === formData.type)
            .map(a => a.subType)
            .filter(Boolean) as string[] || []),
        ...(dynamicCategories
            ?.filter(c => c.type === formData.type)
            .map(c => c.name) || [])
    ])).sort(), [formData.type, accounts, dynamicCategories]);

    const [searchValue, setSearchValue] = useState("");

    // Grouping Logic
    const getGroupedAccounts = (type: string) => {
        const filtered = accounts?.filter(a =>
            a.type === type &&
            (a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.subType || '').toLowerCase().includes(searchQuery.toLowerCase()))
        ) || [];

        const grouped: Record<string, { accounts: Account[], total: number }> = {};

        filtered.forEach(acc => {
            const subType = acc.subType || 'Uncategorized';
            if (!grouped[subType]) {
                grouped[subType] = { accounts: [], total: 0 };
            }
            grouped[subType].accounts.push(acc);
            grouped[subType].total += Number(acc.balance);
        });

        return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
    };

    if (isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow mb-2.5">Structure</p>
                    <h1 className="text-display-sm">Chart of accounts</h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">Every account, category and ledger in one tree.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Plus className="h-4 w-4" />
                                Manage categories
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Manage Categories</DialogTitle>
                                <DialogDescription>
                                    Every category your accounts, budgets and transactions can use. Renaming one renames the accounts that use it.
                                </DialogDescription>
                            </DialogHeader>
                            <CategoryManager />
                        </DialogContent>
                    </Dialog>
                    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90 text-white">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editMode ? 'Edit Account' : 'Create New Account'}</DialogTitle>
                                <DialogDescription>
                                    Define a new account for your double-entry system.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Account Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g., Groceries, Salary, HDFC Bank"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Account Type</Label>
                                        <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value, subType: '' })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accountTypes.map(type => (
                                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2 flex flex-col">
                                        <Label htmlFor="subType">Sub Type / Category</Label>
                                        <Popover open={subTypeOpen} onOpenChange={setSubTypeOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={subTypeOpen}
                                                    className="w-full justify-between"
                                                >
                                                    {formData.subType || "Select or create sub-type..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0" align="start">
                                                <Command>
                                                    <CommandInput
                                                        placeholder="Search sub-type..."
                                                        value={searchValue}
                                                        onValueChange={setSearchValue}
                                                    />
                                                    <CommandList className="max-h-[300px] overflow-y-auto">
                                                        <CommandEmpty>
                                                            <div className="p-2">
                                                                <p className="text-sm text-muted-foreground mb-2">No sub-type found.</p>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, subType: searchValue });
                                                                        setSubTypeOpen(false);
                                                                    }}
                                                                >
                                                                    Create "{searchValue}"
                                                                </Button>
                                                            </div>
                                                        </CommandEmpty>
                                                        <CommandGroup heading="Existing Sub-Types">
                                                            {existingSubTypes.map((subType) => (
                                                                <CommandItem
                                                                    key={subType}
                                                                    value={subType}
                                                                    onSelect={(currentValue) => {
                                                                        setFormData({ ...formData, subType: currentValue });
                                                                        setSubTypeOpen(false);
                                                                    }}
                                                                    className="cursor-pointer"
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            formData.subType === subType ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {subType}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <p className="text-xs text-muted-foreground">Select from existing or type a new one to create a new category.</p>
                                    </div>
                                    {!editMode && (
                                        <div className="space-y-2">
                                            <Label htmlFor="openingBalance">Opening Balance (₹)</Label>
                                            <Input
                                                id="openingBalance"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={formData.openingBalance}
                                                onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                                            />
                                            <p className="text-xs text-muted-foreground">Initial balance (creates an Equity transaction)</p>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={addAccount.isPending || editAccount.isPending}>
                                        {editMode ? 'Update Account' : 'Create Account'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search accounts by name or category…"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <Tabs defaultValue="ASSET" className="space-y-4">
                <TabsList className="h-auto w-full flex-wrap justify-start">
                    {accountTypes.map(type => (
                        <TabsTrigger
                            key={type}
                            value={type}
                        >
                            {type}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {accountTypes.map(type => {
                    const groupedAccounts = getGroupedAccounts(type);

                    return (
                        <TabsContent key={type} value={type} className="space-y-4">
                            {groupedAccounts.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border rounded-lg glass-card border-dashed border-white/10">
                                    No {type.toLowerCase()} accounts found matching your search.
                                </div>
                            ) : (
                                <Accordion type="multiple" className="w-full space-y-4">
                                    {groupedAccounts.map(([subType, { accounts: groupAccounts, total }]) => (
                                        <AccordionItem key={subType} value={subType} className="border-0 rounded-xl glass-card px-4 overflow-hidden">
                                            <AccordionTrigger className="hover:no-underline py-4">
                                                <div className="flex items-center justify-between w-full pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-lg capitalize">{subType}</span>
                                                        <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                                                            {groupAccounts.length}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Total: <span className={cn("text-foreground font-bold", total < 0 && "text-destructive")}>{formatCurrency(total)}</span>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-4">
                                                <div className="grid gap-2">
                                                    {groupAccounts.map(account => (
                                                        <div key={account.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg bg-background/40 border border-white/5 hover:bg-background/60 hover:border-primary/20 transition-all duration-300 gap-3 group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                                                                    {getIcon(account.type)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium">{account.name}</div>
                                                                    {account.symbol && (
                                                                        <div className="text-xs text-muted-foreground">{account.symbol}</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 w-full md:w-auto">
                                                                <div className="text-right">
                                                                    <div className="font-bold">{formatCurrency(Number(account.balance))}</div>
                                                                    <div className="text-xs text-muted-foreground">Current Balance</div>
                                                                </div>

                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:text-primary"
                                                                        onClick={() => setLedgerDialog({ open: true, accountId: account.id, accountName: account.name })}
                                                                        title="View Ledger"
                                                                    >
                                                                        <FileText className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:text-primary"
                                                                        onClick={() => handleEdit(account)}
                                                                        title="Edit Account"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:text-primary"
                                                                        onClick={() => handleExportLedger(account.id, account.name)}
                                                                        title="Quick Export"
                                                                    >
                                                                        <FileSpreadsheet className="h-4 w-4" />
                                                                    </Button>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    This will permanently delete this account and all associated transactions.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleDelete(account.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                                    Delete
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </TabsContent>
                    );
                })}
            </Tabs>

            <LedgerViewDialog
                open={ledgerDialog.open}
                onOpenChange={(open) => setLedgerDialog(prev => ({ ...prev, open }))}
                accountId={ledgerDialog.accountId}
                accountName={ledgerDialog.accountName}
                onAccountChange={(id: number, name: string) => setLedgerDialog({ open: true, accountId: id, accountName: name })}
            />
        </div>
    );
}

