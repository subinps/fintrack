import { useState, useMemo } from 'react';
import { useGetTransactions, useGetAccounts } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, ArrowLeft, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InteractiveBarChart } from './charts/InteractiveBarChart';
import { InteractivePieChart } from './charts/InteractivePieChart';
import { format } from 'date-fns';
import { TransactionDialog } from './TransactionDialog';
import { PageGuide } from '@/components/system/PageGuide';
import { PAGE_HELP } from '@/lib/page-help';


type ViewLevel = 'monthly' | 'category' | 'transactions';

export function IncomeExpenseTab() {
    const { data: transactions, isLoading: transactionsLoading } = useGetTransactions();
    const { data: accounts, isLoading: accountsLoading } = useGetAccounts();

    const [viewLevel, setViewLevel] = useState<ViewLevel>('monthly');
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<'income' | 'expense' | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

    // Helper to format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Process Data
    const processedData = useMemo(() => {
        if (!transactions || !accounts) return null;

        const incomeAccounts = accounts.filter(a => a.type === 'INCOME').map(a => a.id.toString());
        const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE').map(a => a.id.toString());

        const monthlyData: Record<string, { name: string; income: number; expense: number; date: Date }> = {};
        const transactionsByMonth: Record<string, any[]> = {};

        transactions.forEach(t => {
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { name: monthName, income: 0, expense: 0, date };
                transactionsByMonth[monthKey] = [];
            }
            transactionsByMonth[monthKey].push(t);

            t.splits.forEach(split => {
                const amount = Number(split.amount) / 100;
                if (incomeAccounts.includes(split.accountId.toString())) {
                    if (amount < 0) monthlyData[monthKey].income += Math.abs(amount);
                    else monthlyData[monthKey].income -= amount;
                } else if (expenseAccounts.includes(split.accountId.toString())) {
                    if (amount > 0) monthlyData[monthKey].expense += amount;
                    else monthlyData[monthKey].expense -= Math.abs(amount);
                }
            });
        });

        const sortedKeys = Object.keys(monthlyData).sort();
        const chartData = sortedKeys.map(key => ({ ...monthlyData[key], key }));

        const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
        const totalExpense = chartData.reduce((sum, d) => sum + d.expense, 0);

        return { chartData, transactionsByMonth, totalIncome, totalExpense, incomeAccounts, expenseAccounts };
    }, [transactions, accounts]);

    if (transactionsLoading || accountsLoading || !processedData) {
        return <Skeleton className="h-[500px] w-full" />;
    }

    const { chartData, transactionsByMonth, totalIncome, totalExpense, incomeAccounts, expenseAccounts } = processedData;
    const netSavings = totalIncome - totalExpense;

    // Drill-down Logic
    const handleMonthClick = (data: any) => {
        setSelectedMonth(data.key);
        setViewLevel('category');
    };

    const handleCategoryClick = (data: any, type: 'income' | 'expense') => {
        setSelectedType(type);
        setSelectedCategory(data.name);
        setViewLevel('transactions');
    };

    const handleBack = () => {
        if (viewLevel === 'transactions') {
            setViewLevel('category');
            setSelectedCategory(null);
            setSelectedType(null);
        } else if (viewLevel === 'category') {
            setViewLevel('monthly');
            setSelectedMonth(null);
        }
    };

    // Level 1: Category Data for Selected Month
    const getCategoryData = () => {
        if (!selectedMonth) return { income: [], expense: [] };

        const monthTransactions = transactionsByMonth[selectedMonth] || [];
        const incomeMap: Record<string, number> = {};
        const expenseMap: Record<string, number> = {};

        monthTransactions.forEach(t => {
            t.splits.forEach((split: any) => {
                const amount = Number(split.amount) / 100;
                const account = accounts?.find(a => a.id === split.accountId);
                if (!account) return;

                if (incomeAccounts.includes(account.id.toString())) {
                    const val = amount < 0 ? Math.abs(amount) : -amount;
                    if (val > 0) incomeMap[account.name] = (incomeMap[account.name] || 0) + val;
                } else if (expenseAccounts.includes(account.id.toString())) {
                    const val = amount > 0 ? amount : -Math.abs(amount);
                    if (val > 0) expenseMap[account.name] = (expenseMap[account.name] || 0) + val;
                }
            });
        });

        return {
            income: Object.entries(incomeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
            expense: Object.entries(expenseMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
        };
    };

    // Level 2: Transactions for Selected Category
    const getFilteredTransactions = () => {
        if (!selectedMonth || !selectedCategory || !selectedType) return [];

        const monthTransactions = transactionsByMonth[selectedMonth] || [];
        return monthTransactions.filter(t => {
            return t.splits.some((split: any) => {
                const account = accounts?.find(a => a.id === split.accountId);
                if (!account) return false;

                const isCorrectType = selectedType === 'income' ? incomeAccounts.includes(account.id.toString()) : expenseAccounts.includes(account.id.toString());
                return isCorrectType && account.name === selectedCategory;
            });
        });
    };

    const categoryData = getCategoryData();
    const filteredTransactions = getFilteredTransactions();

    return (
        <div className="space-y-6">
            {viewLevel === 'monthly' && <PageGuide {...PAGE_HELP['income-expense']} />}

            {/* Summary Cards - Only show on top level */}
            {viewLevel === 'monthly' && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="glass-card border-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
                            <TrendingUp className="h-4 w-4 text-success" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-success">{formatCurrency(totalIncome)}</div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card border-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                            <TrendingDown className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpense)}</div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card border-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Net Savings</CardTitle>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${netSavings >= 0 ? 'text-primary' : 'text-warning'}`}>
                                {formatCurrency(netSavings)}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Header with Back Button */}
            {viewLevel !== 'monthly' && (
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={handleBack} className="hover:bg-primary/10 hover:text-primary border-primary/20">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <h2 className="text-xl font-semibold">
                        {viewLevel === 'category' && format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
                        {viewLevel === 'transactions' && `${selectedCategory} (${format(new Date(selectedMonth + '-01'), 'MMM yyyy')})`}
                    </h2>
                </div>
            )}

            {/* Level 0: Monthly Bar Chart */}
            {viewLevel === 'monthly' && (
                <Card className="glass-card border-0">
                    <CardHeader>
                        <CardTitle>Income vs Expenses (Monthly)</CardTitle>
                        <CardDescription>Click on a bar to view category breakdown for that month.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <InteractiveBarChart
                            data={chartData}
                            bars={[
                                { key: 'income', name: 'Income', color: 'hsl(var(--success))' },
                                { key: 'expense', name: 'Expenses', color: 'hsl(var(--destructive))' }
                            ]}
                            formatter={formatCurrency}
                            onBarClick={handleMonthClick}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Level 1: Category Pie Charts */}
            {viewLevel === 'category' && (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="glass-card border-0">
                        <CardHeader>
                            <CardTitle>Income Breakdown</CardTitle>
                            <CardDescription>Click a slice to view transactions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {categoryData.income.length > 0 ? (
                                <InteractivePieChart
                                    data={categoryData.income}
                                    formatter={formatCurrency}
                                    onSliceClick={(data) => handleCategoryClick(data, 'income')}
                                    centerText={{
                                        title: 'Total Income',
                                        value: formatCurrency(categoryData.income.reduce((a, b) => a + b.value, 0))
                                    }}
                                />
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-muted-foreground">No income this month</div>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="glass-card border-0">
                        <CardHeader>
                            <CardTitle>Expense Breakdown</CardTitle>
                            <CardDescription>Click a slice to view transactions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {categoryData.expense.length > 0 ? (
                                <InteractivePieChart
                                    data={categoryData.expense}
                                    formatter={formatCurrency}
                                    onSliceClick={(data) => handleCategoryClick(data, 'expense')}
                                    centerText={{
                                        title: 'Total Expense',
                                        value: formatCurrency(categoryData.expense.reduce((a, b) => a + b.value, 0))
                                    }}
                                />
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-muted-foreground">No expenses this month</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Level 2: Transactions List */}
            {viewLevel === 'transactions' && (
                <Card className="glass-card border-0">
                    <CardHeader>
                        <CardTitle>Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {filteredTransactions.map(t => {
                                // Calculate amount for the selected category
                                const relevantSplit = t.splits.find((split: any) => {
                                    const account = accounts?.find(a => a.id === split.accountId);
                                    return account && account.name === selectedCategory;
                                });
                                const amount = relevantSplit ? Math.abs(Number(relevantSplit.amount)) : 0;

                                return (
                                    <div
                                        key={t.id}
                                        className="group flex cursor-pointer items-center justify-between gap-3 rounded-control border border-border bg-card px-4 py-3 transition-colors hover:bg-surface"
                                        onClick={() => {
                                            setEditingTransaction(t);
                                            setTransactionDialogOpen(true);
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-full bg-primary/10 group-hover:scale-110 transition-transform duration-300">
                                                <Calendar className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{t.description}</p>
                                                <p className="text-sm text-muted-foreground">{format(new Date(t.date), 'dd MMM yyyy')}</p>
                                            </div>
                                        </div>
                                        <div className={`font-bold ${selectedType === 'income' ? 'text-success' : 'text-destructive'}`}>
                                            {formatCurrency(amount / 100)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <TransactionDialog
                open={transactionDialogOpen}
                onOpenChange={setTransactionDialogOpen}
                transaction={editingTransaction}
                onSuccess={() => {
                    setEditingTransaction(null);
                    // In a real app, we might need to refetch or update local state
                    // React Query handles refetching automatically if we invalidate queries
                }}
            />
        </div>
    );
}
