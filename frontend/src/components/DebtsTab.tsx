import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useGetDebts, useGetReceivables, useAddDebt, useEditDebt, useDeleteDebt } from '../hooks/useQueries';
import { Plus, CreditCard, AlertCircle, Edit, Trash2, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import type { Account } from '../hooks/useQueries';

import { LedgerViewDialog } from './LedgerViewDialog';
import { LoansPanel } from './LoansPanel';

export function DebtsTab() {
  const { data: debts, isLoading: debtsLoading } = useGetDebts();
  const { data: receivables, isLoading: receivablesLoading } = useGetReceivables();
  const addDebt = useAddDebt();
  const editDebt = useEditDebt();
  const deleteDebt = useDeleteDebt();
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    interestRate: '',
    dueDate: '',
    isReceivable: false,
    openingBalance: '',
  });

  // Ledger Dialog State
  const [ledgerDialog, setLedgerDialog] = useState<{ open: boolean; accountId: number | null; accountName: string }>({
    open: false,
    accountId: null,
    accountName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      // In double entry, amount is balance. But for creating account, we might not set balance directly.
      // However, for debts, we usually want to record the initial loan amount.
      // We'll assume creating the account sets the properties.
      // If we want to set initial balance, we'd need a transaction.
      // For now, we'll just set the account metadata.

      const payload = {
        name: formData.name,
        type: formData.isReceivable ? 'ASSET' : 'LIABILITY',
        subType: formData.isReceivable ? 'receivable' : 'debt',
        interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        openingBalance: formData.openingBalance || formData.amount, // Use amount as opening balance if not specified
      };

      if (editMode && editingDebt) {
        await editDebt.mutateAsync({
          id: editingDebt.id,
          ...payload,
        });
        toast.success(formData.isReceivable ? 'Receivable updated successfully' : 'Debt updated successfully');
      } else {
        await addDebt.mutateAsync(payload);
        toast.success(formData.isReceivable ? 'Receivable added successfully' : 'Debt added successfully');
      }
      setOpen(false);
      setEditMode(false);
      setEditingDebt(null);
      setFormData({ name: '', amount: '', interestRate: '', dueDate: '', isReceivable: false, openingBalance: '' });
    } catch (error) {
      toast.error(editMode ? 'Failed to update' : 'Failed to add');
    }
  };

  const handleEdit = (debt: Account) => {
    setEditingDebt(debt);
    setEditMode(true);
    const isReceivable = debt.type === 'ASSET';
    setFormData({
      name: debt.name,
      amount: debt.balance, // Current balance
      interestRate: debt.interestRate?.toString() || '',
      dueDate: debt.dueDate ? new Date(debt.dueDate).toISOString().split('T')[0] : '',
      isReceivable: isReceivable,
      openingBalance: '',
    });
    setOpen(true);
  };

  const handleDelete = async (debtId: number) => {
    try {
      await deleteDebt.mutateAsync(debtId);
      toast.success('Deleted successfully');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditMode(false);
      setEditingDebt(null);
      setFormData({ name: '', amount: '', interestRate: '', dueDate: '', isReceivable: false, openingBalance: '' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  if (debtsLoading || receivablesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const liabilities = debts || [];
  const assets = receivables || [];

  // Balance is string from backend, convert to number.
  // Liability balance is usually negative (credit), but we display magnitude.
  const totalDebt = liabilities.reduce((sum, debt) => sum + Math.abs(Number(debt.balance)), 0);
  const totalReceivables = assets.reduce((sum, debt) => sum + Number(debt.balance), 0);

  const renderDebtCard = (debt: Account) => {
    const dueDate = debt.dueDate ? new Date(debt.dueDate) : null;
    const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
    const isReceivable = debt.type === 'ASSET';
    const balance = Math.abs(Number(debt.balance));

    return (
      <Card
        key={debt.id.toString()}
        className="transition-all duration-300 hover:shadow-xl hover:scale-[1.02] glass-card border-0 cursor-pointer"
        onClick={() => setLedgerDialog({ open: true, accountId: debt.id, accountName: debt.name })}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isReceivable ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <CreditCard className="h-5 w-5 text-destructive" />
              )}
              <span className="truncate">{debt.name}</span>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(debt)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this {isReceivable ? 'receivable' : 'debt'}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(debt.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardTitle>
          <CardDescription>
            {debt.interestRate ? `${debt.interestRate}% interest rate` : 'No interest rate set'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">{isReceivable ? 'Amount to Receive' : 'Outstanding Amount'}</p>
            <p className={`tabular text-2xl font-semibold ${isReceivable ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
          {dueDate && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Due Date</span>
                <span className={isOverdue ? 'text-destructive font-medium' : 'text-foreground'}>
                  {dueDate.toLocaleDateString('en-IN')}
                </span>
              </div>
              {isOverdue ? (
                <p className="text-xs text-destructive font-medium">Overdue by {Math.abs(daysUntilDue!)} days</p>
              ) : (
                <p className="text-xs text-muted-foreground">{daysUntilDue} days remaining</p>
              )}
            </div>
          )}
          {!dueDate && (
            <p className="text-xs text-muted-foreground">No due date set</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2.5">Commitments</p>
          <h1 className="text-display-sm">Debts &amp; receivables</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Loans and obligations on one side, money owed to you on the other.</p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Entry' : 'Add Debt or Receivable'}</DialogTitle>
              <DialogDescription>Enter the details of your debt or receivable</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="isReceivable" className="flex-1">
                    <div className="font-medium">Receivable (Money Owed to You)</div>
                    <div className="text-xs text-muted-foreground">Toggle on if this is money someone owes you</div>
                  </Label>
                  <Switch
                    id="isReceivable"
                    checked={formData.isReceivable}
                    onCheckedChange={(checked) => setFormData({ ...formData, isReceivable: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{formData.isReceivable ? 'Receivable Name' : 'Debt Name'}</Label>
                  <Input
                    id="name"
                    placeholder={formData.isReceivable ? 'e.g., Loan to John, Money Lent' : 'e.g., Home Loan, Credit Card'}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="500000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Initial amount (Note: Balance is updated via transactions)</p>
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
                    <p className="text-xs text-muted-foreground">Initial balance if different from Amount</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="interestRate">Interest Rate (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    placeholder="8.5"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date (Optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addDebt.isPending || editDebt.isPending}>
                  {addDebt.isPending || editDebt.isPending
                    ? editMode
                      ? 'Updating...'
                      : 'Adding...'
                    : editMode
                      ? 'Update'
                      : 'Add Entry'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Total Outstanding Debt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive">{formatCurrency(totalDebt)}</div>
            <p className="text-sm text-muted-foreground mt-2">{liabilities.length} debt accounts</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-success" />
              Total Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular text-3xl font-semibold tracking-[-0.02em] text-success">{formatCurrency(totalReceivables)}</div>
            <p className="text-sm text-muted-foreground mt-2">{assets.length} receivable accounts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="debts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="debts">Debts ({liabilities.length})</TabsTrigger>
          <TabsTrigger value="receivables">Receivables ({assets.length})</TabsTrigger>
          <TabsTrigger value="loans">Loans &amp; cards</TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="space-y-4">
          <LoansPanel />
        </TabsContent>

        <TabsContent value="debts" className="space-y-4">
          {liabilities.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liabilities.map(renderDebtCard)}
            </div>
          ) : (
            <Card className="glass-card border-0">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No debts recorded</p>
                <p className="text-sm text-muted-foreground mb-4">Track your loans and credit obligations here</p>
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Debt
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="receivables" className="space-y-4">
          {assets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assets.map(renderDebtCard)}
            </div>
          ) : (
            <Card className="glass-card border-0">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No receivables recorded</p>
                <p className="text-sm text-muted-foreground mb-4">Track money owed to you here</p>
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Receivable
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
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
