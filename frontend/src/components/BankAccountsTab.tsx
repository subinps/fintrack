import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetBankAccounts, useAddAccount, useEditAccount, useDeleteAccount } from '../hooks/useQueries';
import { Plus, Wallet, Building2, Edit, Trash2, CreditCard, ArrowLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Account } from '../hooks/useQueries';
import { AccountBalanceHistoryDialog } from './AccountBalanceHistoryDialog';
import { History } from 'lucide-react';

import { LedgerViewDialog } from './LedgerViewDialog';

export function BankAccountsTab() {
  const { data: accounts, isLoading } = useGetBankAccounts();
  const addAccount = useAddAccount();
  const editAccount = useEditAccount();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subType: 'savings',
    openingBalance: '',
  });
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<{ id: number; name: string } | null>(null);

  // Ledger Dialog State
  const [ledgerDialog, setLedgerDialog] = useState<{ open: boolean; accountId: number | null; accountName: string }>({
    open: false,
    accountId: null,
    accountName: '',
  });

  const handleHistory = (account: Account) => {
    setHistoryAccount({ id: account.id, name: account.name });
    setHistoryDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.subType) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      if (editMode && editingAccount) {
        await editAccount.mutateAsync({
          id: editingAccount.id,
          name: formData.name,
          type: formData.subType === 'credit-card' ? 'LIABILITY' : 'ASSET',
          subType: formData.subType,
        });
        toast.success('Account updated successfully');
      } else {
        await addAccount.mutateAsync({
          name: formData.name,
          type: formData.subType === 'credit-card' ? 'LIABILITY' : 'ASSET',
          subType: formData.subType,
          openingBalance: formData.openingBalance,
        });
        toast.success('Account added successfully');
      }
      setOpen(false);
      setEditMode(false);
      setEditingAccount(null);
      setFormData({ name: '', subType: 'savings', openingBalance: '' });
    } catch (error) {
      toast.error(editMode ? 'Failed to update account' : 'Failed to add account');
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setEditMode(true);
    setFormData({
      name: account.name,
      subType: account.subType || 'savings',
      openingBalance: '', // Cannot edit opening balance easily after creation without complex logic
    });
    setOpen(true);
  };

  const handleDelete = async (accountId: number) => {
    try {
      await deleteAccount.mutateAsync(accountId);
      toast.success('Account deleted successfully');
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditMode(false);
      setEditingAccount(null);
      setFormData({ name: '', subType: 'savings', openingBalance: '' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalBalance = accounts?.reduce((sum: number, acc: Account) => sum + Number(acc.balance), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Accounts</h1>
          <p className="text-muted-foreground">Manage your bank accounts and cash balances</p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Account' : 'Add New Account'}</DialogTitle>
              <DialogDescription>
                {editMode ? 'Update account details' : 'Enter the details of your new bank account'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Account Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., HDFC Savings, Wallet, Cash"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Account Type</Label>
                  <Select value={formData.subType} onValueChange={(value: string) => setFormData({ ...formData, subType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings Account</SelectItem>
                      <SelectItem value="current">Current Account</SelectItem>
                      <SelectItem value="wallet">Wallet / Cash</SelectItem>
                      <SelectItem value="credit-card">Credit Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, openingBalance: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Initial balance in this account</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addAccount.isPending || editAccount.isPending}>
                  {addAccount.isPending || editAccount.isPending
                    ? editMode
                      ? 'Updating...'
                      : 'Adding...'
                    : editMode
                      ? 'Update Account'
                      : 'Add Account'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Liquid Assets
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {accounts?.length || 0} accounts
          </p>
        </CardContent>
      </Card>

      {accounts && accounts.length > 0 ? (
        <div className="space-y-4">
          {!selectedType ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {['savings', 'current', 'wallet', 'credit-card', 'other'].map(type => {
                const typeAccounts = accounts.filter((acc: Account) => (acc.subType || 'other') === type);
                if (typeAccounts.length === 0) return null;

                const typeTotal = typeAccounts.reduce((sum: number, acc: Account) => sum + parseFloat(acc.balance), 0);

                return (
                  <Card
                    key={type}
                    className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] glass-card border-0 group"
                    onClick={() => setSelectedType(type)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-lg font-medium capitalize">
                        {type.replace('-', ' ')}
                      </CardTitle>
                      {type === 'wallet' ? (
                        <Wallet className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      ) : type === 'credit-card' ? (
                        <CreditCard className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${type === 'credit-card' ? 'text-destructive' : ''}`}>
                        {formatCurrency(typeTotal)}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {typeAccounts.length} {typeAccounts.length === 1 ? 'Account' : 'Accounts'}
                        </p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary" onClick={() => setSelectedType(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Categories
              </Button>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold capitalize">{selectedType.replace('-', ' ')}</h2>
                <span className="text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full text-sm">
                  {accounts.filter((acc: Account) => (acc.subType || 'other') === selectedType).length} Accounts
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.filter((acc: Account) => (acc.subType || 'other') === selectedType).map((account: Account) => (
                  <Card
                    key={account.id}
                    className="transition-all duration-300 hover:shadow-xl hover:scale-[1.02] glass-card border-0 cursor-pointer"
                    onClick={() => setLedgerDialog({ open: true, accountId: account.id, accountName: account.name })}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {account.name}
                      </CardTitle>
                      {account.subType === 'wallet' ? (
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      ) : account.subType === 'credit-card' ? (
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${account.type === 'LIABILITY' ? 'text-destructive' : ''}`}>
                        {formatCurrency(parseFloat(account.balance))}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize mt-1">
                        {account.subType?.replace('-', ' ') || 'Bank Account'}
                      </p>
                      <div className="flex gap-2 mt-4" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="flex-1 hover:bg-primary/10 hover:text-primary border-primary/20" onClick={() => handleEdit(account)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 hover:bg-primary/10 hover:text-primary border-primary/20" onClick={() => handleHistory(account)}>
                          <History className="mr-2 h-4 w-4" /> History
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this account and all associated transactions. This action cannot be undone.
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="glass-card border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No accounts yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first bank account to start tracking</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      )}


      <AccountBalanceHistoryDialog
        accountId={historyAccount?.id || null}
        accountName={historyAccount?.name || ''}
        isOpen={historyDialogOpen}
        onClose={setHistoryDialogOpen}
      />

      <LedgerViewDialog
        open={ledgerDialog.open}
        onOpenChange={(open) => setLedgerDialog((prev: any) => ({ ...prev, open }))}
        accountId={ledgerDialog.accountId}
        accountName={ledgerDialog.accountName}
        onAccountChange={(id: number, name: string) => setLedgerDialog({ open: true, accountId: id, accountName: name })}
      />
    </div>
  );
}
