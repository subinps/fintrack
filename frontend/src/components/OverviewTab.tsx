import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard } from '@/components/ui/motion-card';

import { useGetAccounts } from '../hooks/useQueries';
import { useCachedMarketData } from '../hooks/useMarketData';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownRight, Wallet, TrendingUp, DollarSign, ArrowRight } from 'lucide-react';
import { InteractivePieChart } from './charts/InteractivePieChart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { NetWorthChart } from './NetWorthChart';

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { data: accounts, isLoading } = useGetAccounts();
  const { getPrice } = useCachedMarketData();
  const [showNetWorthDetails, setShowNetWorthDetails] = useState(false);
  const [showAssetDetails, setShowAssetDetails] = useState(false);

  const assetAccounts = accounts?.filter(a => a.type === 'ASSET') || [];
  const liabilityAccounts = accounts?.filter(a => a.type === 'LIABILITY') || [];

  const calculateMarketValue = (account: any) => {
    if (['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'].includes(account.subType) && account.units) {
      // 1. Try live/cached price from frontend cache
      if (account.symbol) {
        const price = getPrice(account.symbol);
        if (price) {
          return price * account.units * 100;
        }
      }

      // 2. Try stored market price from backend
      if (account.lastMarketPrice) {
        return Number(account.lastMarketPrice) * account.units * 100;
      }
    }
    // 3. Fallback to book value (balance)
    return Number(account.balance);
  };

  const assetAllocationData = useMemo(() => {
    const allocation: Record<string, number> = {};

    assetAccounts.forEach(acc => {
      const type = acc.subType ? acc.subType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other';
      const value = calculateMarketValue(acc);
      allocation[type] = (allocation[type] || 0) + value;
    });

    return Object.entries(allocation)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [assetAccounts]); // getPrice is stable from hook

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate totals
  // Assets: Type = ASSET
  // Liabilities: Type = LIABILITY


  const totalAssetsBook = assetAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalAssetsMarket = assetAccounts.reduce((sum, acc) => sum + calculateMarketValue(acc), 0);

  const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + Math.abs(Number(acc.balance)), 0); // Display as positive

  // Net Worth
  const netWorthBook = totalAssetsBook - totalLiabilities;
  const netWorthMarket = totalAssetsMarket - totalLiabilities;

  // Categorize Assets for display
  const cashAccounts = assetAccounts.filter(a => ['cash', 'wallet', 'savings', 'current'].includes(a.subType?.toLowerCase() || ''));
  const investmentAccounts = assetAccounts.filter(a => !['cash', 'wallet', 'savings', 'current'].includes(a.subType?.toLowerCase() || ''));

  const totalCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalInvestmentsBook = investmentAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalInvestmentsMarket = investmentAccounts.reduce((sum, acc) => sum + calculateMarketValue(acc), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value / 100); // Assuming balance is in cents/paise
  };






  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HoverCard
          className="border-l-4 border-l-primary glass-card cursor-pointer hover:bg-white/5 rounded-2xl"
          disableEntryAnimation
          onClick={() => setShowNetWorthDetails(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(netWorthMarket)}</div>
            <div className="flex flex-col text-xs text-muted-foreground mt-1">
              <span>Market Value: {formatCurrency(netWorthMarket)}</span>
              <span>Book Value: {formatCurrency(netWorthBook)}</span>
            </div>
          </CardContent>
        </HoverCard>

        <HoverCard
          className="border-l-4 border-l-chart-2 glass-card cursor-pointer hover:bg-white/5 rounded-2xl"
          disableEntryAnimation
          onClick={() => setShowAssetDetails(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
            <div className="p-2 bg-chart-2/10 rounded-full">
              <TrendingUp className="h-4 w-4 text-chart-2" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{formatCurrency(totalAssetsMarket)}</div>
            <div className="flex flex-col text-xs text-muted-foreground mt-1 gap-1">
              <div className="flex justify-between gap-2">
                <span>Cash: {formatCurrency(totalCash)}</span>
                <span>Inv: {formatCurrency(totalInvestmentsMarket)} (Book: {formatCurrency(totalInvestmentsBook)})</span>
              </div>
            </div>
          </CardContent>
        </HoverCard>

        <HoverCard
          className="border-l-4 border-l-destructive glass-card cursor-pointer hover:bg-white/5 rounded-2xl"
          disableEntryAnimation
          onClick={() => onNavigate?.('debts')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Liabilities</CardTitle>
            <div className="p-2 bg-destructive/10 rounded-full">
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalLiabilities)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Debt & Payables
            </p>
          </CardContent>
        </HoverCard>

        <HoverCard
          className="border-l-4 border-l-blue-400 glass-card cursor-pointer hover:bg-white/5 rounded-2xl"
          disableEntryAnimation
          onClick={() => onNavigate?.('accounts')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Liquid Cash</CardTitle>
            <div className="p-2 bg-blue-400/10 rounded-full">
              <DollarSign className="h-4 w-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{formatCurrency(totalCash)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Available to spend
            </p>
          </CardContent>
        </HoverCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <HoverCard className="col-span-4 glass-card rounded-2xl" disableEntryAnimation>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {assetAllocationData.length > 0 ? (
                <InteractivePieChart
                  data={assetAllocationData}
                  formatter={formatCurrency}
                  centerText={{
                    title: 'Total Assets',
                    value: formatCurrency(totalAssetsMarket)
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No assets to display
                </div>
              )}
            </div>
          </CardContent>
        </HoverCard>
        <NetWorthChart />
      </div>

      <Dialog open={showNetWorthDetails} onOpenChange={setShowNetWorthDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Net Worth Breakdown</DialogTitle>
            <DialogDescription>
              Your Net Worth is calculated as Total Assets minus Total Liabilities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold text-chart-2">{formatCurrency(totalAssetsMarket)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setShowNetWorthDetails(false); setShowAssetDetails(true); }}>
                View Breakdown <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Liabilities</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalLiabilities)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setShowNetWorthDetails(false); onNavigate?.('debts'); }}>
                View Debts <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Net Worth</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(netWorthMarket)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssetDetails} onOpenChange={setShowAssetDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Total Assets Breakdown</DialogTitle>
            <DialogDescription>
              Your assets are divided between Liquid Cash and Investments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Bank & Cash</p>
                <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalCash)}</p>
                <p className="text-xs text-muted-foreground">Liquid funds available to spend</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setShowAssetDetails(false); onNavigate?.('accounts'); }}>
                View Accounts <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Investments</p>
                <p className="text-2xl font-bold text-chart-2">{formatCurrency(totalInvestmentsMarket)}</p>
                <p className="text-xs text-muted-foreground">Stocks, Mutual Funds, etc.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setShowAssetDetails(false); onNavigate?.('investments'); }}>
                View Investments <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
