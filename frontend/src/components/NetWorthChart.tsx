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
            maximumFractionDigits: 0,
            notation: 'compact',
            compactDisplay: 'short',
        }).format(value / 100);
    };

    if (isLoading) {
        return (
            <Card className="col-span-4 border-white/5 bg-card/50">
                <CardHeader>
                    <CardTitle>Net Worth Growth</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!history || history.length === 0) {
        return (
            <Card className="col-span-4 border-white/5 bg-card/50">
                <CardHeader>
                    <CardTitle>Net Worth Growth</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No data available yet.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-4 border-white/5 bg-card/50">
            <CardHeader>
                <CardTitle>Net Worth Growth</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <InteractiveAreaChart
                    data={history}
                    dataKey="netWorth"
                    color="#10b981"
                    name="Net Worth"
                    formatter={formatCurrency}
                />
            </CardContent>
        </Card>
    );
}
