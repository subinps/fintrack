import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetInvestments, useAddInvestment, useEditInvestment, useDeleteInvestment } from '../hooks/useQueries';
import { Plus, TrendingUp, TrendingDown, DollarSign, PieChart, Edit, Trash2, ArrowLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useRefreshAllPrices, useCachedMarketData } from '../hooks/useMarketData';
import type { Account } from '../hooks/useQueries';

import { LedgerViewDialog } from './LedgerViewDialog';
import { PortfolioPanel } from './PortfolioPanel';

export function InvestmentsTab() {
  const { data: investments, isLoading } = useGetInvestments();
  const addInvestment = useAddInvestment();
  const editInvestment = useEditInvestment();
  const deleteInvestment = useDeleteInvestment();
  const refreshAllPrices = useRefreshAllPrices();
  const { getPrice, getError } = useCachedMarketData();

  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subType: 'stock',
    purchasePrice: '',
    symbol: '',
    units: '',
  });
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Ledger Dialog State
  const [ledgerDialog, setLedgerDialog] = useState<{ open: boolean; accountId: number | null; accountName: string }>({
    open: false,
    accountId: null,
    accountName: '',
  });

  const refreshAttempts = useRef<{ [symbol: string]: number }>({});

  useEffect(() => {
    if (!investments || investments.length === 0) return;

    const checkAndRefreshPrices = () => {
      const now = Date.now();
      const symbolsToRefresh: { symbol: string; accountId: number }[] = [];

      investments.forEach(inv => {
        if (inv.symbol) {
          const lastUpdate = inv.lastMarketUpdate ? new Date(inv.lastMarketUpdate).getTime() : 0;
          const lastAttempt = refreshAttempts.current[inv.symbol] || 0;

          // Check staleness (15 mins) AND local cooldown (5 mins) to prevent loops on failure
          // 15 minutes = 900000 ms
          // 5 minutes = 300000 ms
          if (now - lastUpdate > 900000 && now - lastAttempt > 300000) {
            symbolsToRefresh.push({ symbol: inv.symbol, accountId: inv.id });
            refreshAttempts.current[inv.symbol] = now; // Mark attempt
          }
        }
      });

      if (symbolsToRefresh.length > 0) {
        refreshAllPrices.mutate(symbolsToRefresh);
      }
    };

    // Check immediately on mount/update
    checkAndRefreshPrices();

    // Check every minute
    const intervalId = setInterval(checkAndRefreshPrices, 60000);

    return () => clearInterval(intervalId);
  }, [investments, refreshAllPrices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.subType || !formData.units || !formData.purchasePrice) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const units = parseFloat(formData.units);
      const price = parseFloat(formData.purchasePrice);
      const openingBalance = (units * price).toString(); // Send as Rupees, backend converts to cents

      const payload = {
        name: formData.name,
        type: 'ASSET',
        subType: formData.subType,
        symbol: formData.symbol ? formData.symbol.toUpperCase() : null,
        units: units,
        openingBalance: editMode ? undefined : openingBalance, // Only set opening balance on creation
      };

      if (editMode && editingInvestment) {
        await editInvestment.mutateAsync({
          id: editingInvestment.id,
          ...payload,
        });
        toast.success('Investment updated successfully');
      } else {
        await addInvestment.mutateAsync(payload);
        toast.success('Investment added successfully');
      }
      setOpen(false);
      setEditMode(false);
      setEditingInvestment(null);
      setFormData({ name: '', subType: 'stock', purchasePrice: '', symbol: '', units: '' });
    } catch (error) {
      toast.error(editMode ? 'Failed to update investment' : 'Failed to add investment');
    }
  };

  const handleEdit = (investment: Account) => {
    setEditingInvestment(investment);
    setEditMode(true);

    // Calculate purchase price from balance (cost basis) / units
    const balance = parseFloat(investment.balance) / 100;
    const units = investment.units || 0;
    const purchasePrice = units > 0 ? (balance / units).toFixed(2) : '0';

    setFormData({
      name: investment.name,
      subType: investment.subType || 'stock',
      purchasePrice: purchasePrice,
      symbol: investment.symbol || '',
      units: investment.units?.toString() || '',
    });
    setOpen(true);
  };

  const handleDelete = async (investmentId: number) => {
    try {
      await deleteInvestment.mutateAsync(investmentId);
      toast.success('Investment deleted successfully');
    } catch (error) {
      toast.error('Failed to delete investment');
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditMode(false);
      setEditingInvestment(null);
      setFormData({ name: '', subType: 'stock', purchasePrice: '', symbol: '', units: '' });
    }
  };



  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const getMarketPrice = (symbol: string) => {
    return getPrice(symbol);
  };

  const hasMarketDataError = (symbol: string) => {
    return getError(symbol);
  };

  const calculateCurrentValue = (investment: Account) => {
    // Priority: 1. Stored Last Market Price (from DB, updated via API or Manual), 2. Cost Basis (Balance)
    if (investment.lastMarketPrice && investment.units) {
      // lastMarketPrice is Decimal from Prisma, might be string or number in JSON
      return Number(investment.lastMarketPrice) * investment.units * 100; // Convert to cents
    }

    // Fallback to balance (Invested Amount) if no market price is set
    return Number(investment.balance);
  };

  if (isLoading) {
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

  const totalValue = investments?.reduce((sum, inv) => sum + calculateCurrentValue(inv), 0) || 0;

  const handleManualRefresh = () => {
    if (!investments) return;
    const symbolsToRefresh = investments
      .filter(inv => inv.symbol)
      .map(inv => ({ symbol: inv.symbol!, accountId: inv.id }));

    if (symbolsToRefresh.length > 0) {
      refreshAllPrices.mutate(symbolsToRefresh);
      toast.info('Refreshing market prices...');
    } else {
      toast.info('No symbols to refresh');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2.5">Portfolio</p>
          <h1 className="text-display-sm">Investments</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Holdings priced from market data, valued against book cost.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshAllPrices.isPending}
          >
            <TrendingUp className={`mr-2 h-4 w-4 ${refreshAllPrices.isPending ? 'animate-spin' : ''}`} />
            {refreshAllPrices.isPending ? 'Refreshing...' : 'Refresh Prices'}
          </Button>
          <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Add Investment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editMode ? 'Edit Investment' : 'Add New Investment'}</DialogTitle>
                <DialogDescription>
                  {editMode ? 'Update the details of your investment' : 'Enter the details of your investment.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Investment Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Reliance Industries, HDFC Mutual Fund"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol / Ticker (Optional)</Label>
                    <Input
                      id="symbol"
                      placeholder="e.g., RELIANCE.BSE, AAPL, BTC-USD"
                      value={formData.symbol}
                      onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Stock ticker (e.g., AAPL, RELIANCE.BSE), crypto symbol (e.g., BTC-USD), or mutual fund code
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.subType} onValueChange={(value) => setFormData({ ...formData, subType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stock">Stock</SelectItem>
                        <SelectItem value="mutual-fund">Mutual Fund</SelectItem>
                        <SelectItem value="etf">ETF</SelectItem>
                        <SelectItem value="crypto">Cryptocurrency</SelectItem>
                        <SelectItem value="bond">Bond</SelectItem>
                        <SelectItem value="other-investment">Other Investment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="units">Number of Units</Label>
                      <Input
                        id="units"
                        type="number"
                        step="0.0001"
                        placeholder="10"
                        value={formData.units}
                        onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchasePrice">Purchase Price (₹)</Label>
                      <Input
                        id="purchasePrice"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.purchasePrice}
                        onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Invested: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                      (parseFloat(formData.units || '0') * parseFloat(formData.purchasePrice || '0'))
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addInvestment.isPending || editInvestment.isPending}>
                    {addInvestment.isPending || editInvestment.isPending
                      ? editMode
                        ? 'Updating...'
                        : 'Adding...'
                      : editMode
                        ? 'Update Investment'
                        : 'Add Investment'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Portfolio Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{formatCurrency(totalValue)}</div>
          <p className="text-sm text-muted-foreground mt-2">
            {investments?.length || 0} investments
          </p>
        </CardContent>
      </Card>

      {investments && investments.length > 0 ? (
        <div className="space-y-4">
          <PortfolioPanel />
          {!selectedType ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'].map(type => {
                const typeInvestments = investments.filter(inv => (inv.subType || 'other-investment') === type);
                if (typeInvestments.length === 0) return null;

                const typeTotal = typeInvestments.reduce((sum, inv) => sum + calculateCurrentValue(inv), 0);

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
                      {type === 'crypto' ? (
                        <DollarSign className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      ) : type === 'stock' ? (
                        <TrendingUp className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      ) : (
                        <PieChart className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(typeTotal)}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {typeInvestments.length} {typeInvestments.length === 1 ? 'Investment' : 'Investments'}
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
                  {investments.filter(inv => (inv.subType || 'other-investment') === selectedType).length} Investments
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {investments.filter(inv => (inv.subType || 'other-investment') === selectedType).map((investment) => {
                  const marketPrice = investment.symbol ? getMarketPrice(investment.symbol) : null;
                  const marketError = investment.symbol ? hasMarketDataError(investment.symbol) : null;
                  const invested = Number(investment.balance); // Assuming balance is cost basis
                  const current = calculateCurrentValue(investment);
                  const change = current - invested;
                  const changePercent = invested > 0 ? (change / invested) * 100 : 0;

                  return (
                    <Card
                      key={investment.id}
                      className="transition-all duration-300 hover:shadow-xl hover:scale-[1.02] glass-card border-0 cursor-pointer"
                      onClick={() => setLedgerDialog({ open: true, accountId: investment.id, accountName: investment.name })}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="truncate" title={investment.name}>{investment.name}</span>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {change >= 0 ? (
                              <TrendingUp className="h-4 w-4 shrink-0 text-success" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0 hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleEdit(investment)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0 hover:bg-destructive/10">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Investment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this investment. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(investment.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardTitle>
                        <CardDescription className="text-xs font-mono">{investment.symbol}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {marketError && (
                          <div className="py-1 px-2 h-auto bg-destructive/10 text-destructive rounded mb-2">
                            <p className="text-[10px]">
                              {marketError}
                            </p>
                          </div>
                        )}
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-xs text-muted-foreground">Current Value</p>
                            <p className="text-lg font-bold">{formatCurrency(current)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`tabular font-medium ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Invested</p>
                            <p className="font-medium">{formatCurrency(invested)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Gain/Loss</p>
                            <p className={`tabular font-medium ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatCurrency(change)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Units</p>
                            <p className="font-medium">{investment.units?.toFixed(4)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Live Price</p>
                            <p className="font-medium text-primary">
                              {marketPrice ? formatCurrency(marketPrice * 100) : (investment.lastMarketPrice ? formatCurrency(Number(investment.lastMarketPrice) * 100) + '*' : '-')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="glass-card border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No investments yet</p>
            <p className="text-sm text-muted-foreground mb-4">Start tracking your portfolio by adding your first investment</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Investment
            </Button>
          </CardContent>
        </Card>
      )}

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
