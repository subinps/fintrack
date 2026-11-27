import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGetNetWorthHistory } from '../hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { InteractiveAreaChart } from './charts/InteractiveAreaChart';

export function NetWorthChart() {
    const { data: history, isLoading } = useGetNetWorthHistory();

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 1,
            notation: 'compact',
            compactDisplay: 'short',
        }).format(value / 100);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <p className="eyebrow mb-1.5">History</p>
                    <CardTitle>Net worth over time</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[280px] w-full rounded-control" />
                </CardContent>
            </Card>
        );
    }

    if (!history || history.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <p className="eyebrow mb-1.5">History</p>
                    <CardTitle>Net worth over time</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[280px] flex-col items-center justify-center gap-2 rounded-control border border-dashed border-border text-center">
                        <p className="text-sm font-medium text-foreground">No snapshots yet</p>
                        <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
                            A snapshot is recorded as your balances change. Come back after your first transaction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                    <p className="eyebrow mb-1.5">History</p>
                    <CardTitle>Net worth over time</CardTitle>
                </div>
                <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {history.length} snapshots
                </span>
            </CardHeader>
            <CardContent className="pl-1 pr-3">
                <InteractiveAreaChart
                    data={history}
                    dataKey="netWorth"
                    color="hsl(var(--chart-1))"
                    name="Net worth"
                    height={280}
                    formatter={formatCurrency}
                />
            </CardContent>
        </Card>
    );
}
