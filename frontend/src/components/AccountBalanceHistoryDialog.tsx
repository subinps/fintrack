import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetAccountBalanceHistory } from '../hooks/useQueries';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface AccountBalanceHistoryDialogProps {
    accountId: number | null;
    accountName: string;
    isOpen: boolean;
    onClose: (isOpen: boolean) => void;
}

export function AccountBalanceHistoryDialog({ accountId, accountName, isOpen, onClose }: AccountBalanceHistoryDialogProps) {
    const [period, setPeriod] = useState<'day' | 'month'>('day');
    const { data: history, isLoading } = useGetAccountBalanceHistory(accountId || 0, period);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (period === 'month') {
            return format(date, 'MMM yyyy');
        }
        return format(date, 'dd MMM');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                    <DialogTitle>Balance History - {accountName}</DialogTitle>
                    <div className="w-[150px]">
                        <Select value={period} onValueChange={(v: 'day' | 'month') => setPeriod(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Daily</SelectItem>
                                <SelectItem value="month">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </DialogHeader>

                <div className="h-[400px] w-full mt-4">
                    {isLoading ? (
                        <div className="h-full w-full flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : history && history.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatDate}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                />
                                <YAxis
                                    tickFormatter={(val) => formatCurrency(val).replace('₹', '')}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={78}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                                    labelFormatter={(label) => formatDate(label)}
                                    formatter={(value: number) => [formatCurrency(value), 'Balance']}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="balance"
                                    stroke="hsl(var(--success))"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            No history data available
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
