import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Filter, Download, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGetLedger } from '../hooks/useQueries';
import api from '../lib/api';
import { toast } from 'sonner';
import { DateRange } from 'react-day-picker';
import { TransactionDialog } from './TransactionDialog';

interface LedgerViewDialogProps {
    accountId: number | null;
    accountName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAccountChange?: (accountId: number, accountName: string) => void;
}

type FilterOperator = 'contains' | 'doesNotContain' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';

interface ColumnFilter {
    column: string;
    operator: FilterOperator;
    value: string;
}

export function LedgerViewDialog({ accountId, accountName, open, onOpenChange, onAccountChange }: LedgerViewDialogProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [isExporting, setIsExporting] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [filters, setFilters] = useState<ColumnFilter[]>([]);
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

    const { data: ledgerData, isLoading, refetch } = useGetLedger(accountId, dateRange?.from, dateRange?.to);

    const filteredData = useMemo(() => {
        if (!ledgerData) return [];
        return ledgerData.filter(row => {
            return filters.every(filter => {
                if (!filter.value) return true;

                let cellValue: any;
                if (filter.column === 'description') cellValue = row.description;
                else if (filter.column === 'accountInvolved') cellValue = row.accountInvolved;
                else if (filter.column === 'debit') cellValue = row.debit ? parseFloat(row.debit) : 0;
                else if (filter.column === 'credit') cellValue = row.credit ? parseFloat(row.credit) : 0;

                const filterValue = filter.column === 'debit' || filter.column === 'credit'
                    ? parseFloat(filter.value)
                    : filter.value.toLowerCase();

                if (typeof cellValue === 'string') {
                    cellValue = cellValue.toLowerCase();
                    if (filter.operator === 'contains') return cellValue.includes(filterValue);
                    if (filter.operator === 'doesNotContain') return !cellValue.includes(filterValue);
                    if (filter.operator === 'equals') return cellValue === filterValue;
                    if (filter.operator === 'notEquals') return cellValue !== filterValue;
                    if (filter.operator === 'startsWith') return cellValue.startsWith(filterValue);
                    if (filter.operator === 'endsWith') return cellValue.endsWith(filterValue);
                } else if (typeof cellValue === 'number') {
                    if (isNaN(filterValue as number)) return true;
                    if (filter.operator === 'gt') return cellValue > (filterValue as number);
                    if (filter.operator === 'lt') return cellValue < (filterValue as number);
                    if (filter.operator === 'gte') return cellValue >= (filterValue as number);
                    if (filter.operator === 'lte') return cellValue <= (filterValue as number);
                    if (filter.operator === 'eq') return cellValue === (filterValue as number);
                    if (filter.operator === 'neq') return cellValue !== (filterValue as number);
                }
                return true;
            });
        });
    }, [ledgerData, filters]);

    const handleExport = async (type: 'current' | 'all') => {
        if (!accountId) return;
        setIsExporting(true);
        try {
            if (type === 'current') {
                // Client-side CSV export
                const headers = ['Date', 'Description', 'Account Involved', 'Debit', 'Credit', 'Balance'];
                const csvContent = [
                    headers.join(','),
                    ...filteredData.map(row => [
                        row.date ? format(new Date(row.date), 'yyyy-MM-dd') : '',
                        `"${row.description.replace(/"/g, '""')}"`,
                        `"${row.accountInvolved.replace(/"/g, '""')}"`,
                        row.debit || '',
                        row.credit || '',
                        row.balance
                    ].join(','))
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `ledger_${accountName.replace(/[^a-z0-9]/gi, '_')}_filtered.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Filtered view exported successfully');
            } else {
                // Server-side Excel export
                const params = new URLSearchParams();
                if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
                if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());

                const response = await api.get(`/accounts/${accountId}/export?${params.toString()}`, {
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
            }
            setExportDialogOpen(false);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export ledger');
        } finally {
            setIsExporting(false);
        }
    };

    const addFilter = (column: string, operator: FilterOperator, value: string) => {
        setFilters(prev => {
            const existing = prev.filter(f => f.column !== column);
            if (!value) return existing;
            return [...existing, { column, operator, value }];
        });
    };

    const removeFilter = (column: string) => {
        setFilters(prev => prev.filter(f => f.column !== column));
    };

    const getFilterValue = (column: string) => filters.find(f => f.column === column)?.value || '';
    const getFilterOperator = (column: string) => filters.find(f => f.column === column)?.operator || (column === 'debit' || column === 'credit' ? 'gt' : 'contains');

    const FilterPopover = ({ column, title, type }: { column: string, title: string, type: 'text' | 'number' }) => {
        const [tempValue, setTempValue] = useState(getFilterValue(column));
        const [tempOperator, setTempOperator] = useState<FilterOperator>(getFilterOperator(column));
        const [isOpen, setIsOpen] = useState(false);

        const handleApply = () => {
            addFilter(column, tempOperator, tempValue);
            setIsOpen(false);
        };

        const handleClear = () => {
            removeFilter(column);
            setTempValue('');
            setIsOpen(false);
        };

        return (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", getFilterValue(column) ? "text-primary bg-primary/10" : "text-muted-foreground")}>
                        <Filter className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium leading-none">Filter {title}</h4>
                            {getFilterValue(column) && (
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground hover:text-destructive" onClick={handleClear}>
                                    Clear
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Select
                                value={tempOperator}
                                onValueChange={(v) => setTempOperator(v as FilterOperator)}
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {type === 'text' ? (
                                        <>
                                            <SelectItem value="contains">Contains</SelectItem>
                                            <SelectItem value="doesNotContain">Does not contain</SelectItem>
                                            <SelectItem value="equals">Equals</SelectItem>
                                            <SelectItem value="notEquals">Not Equals</SelectItem>
                                            <SelectItem value="startsWith">Starts with</SelectItem>
                                            <SelectItem value="endsWith">Ends with</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="gt">Greater than</SelectItem>
                                            <SelectItem value="gte">Greater or equal</SelectItem>
                                            <SelectItem value="lt">Less than</SelectItem>
                                            <SelectItem value="lte">Less or equal</SelectItem>
                                            <SelectItem value="eq">Equal to</SelectItem>
                                            <SelectItem value="neq">Not equal to</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="Value..."
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleApply();
                                }}
                            />
                        </div>
                        <Button className="w-full" size="sm" onClick={handleApply}>
                            Apply Filter
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };

    const handleRowClick = (row: any) => {
        if (row.transactionId) {
            api.get(`/transactions`).then(res => {
                const found = res.data.find((t: any) => t.id === row.transactionId);
                if (found) {
                    setEditingTransaction(found);
                    setTransactionDialogOpen(true);
                }
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Ledger View: {accountName}
                    </DialogTitle>
                    <DialogDescription>
                        Detailed transaction history and running balance.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row gap-4 py-4 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal",
                                        !dateRange?.from && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                                {format(dateRange.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date range</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={(range: DateRange | undefined) => setDateRange(range)}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                        {(dateRange?.from || dateRange?.to) && (
                            <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                                Clear
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setExportDialogOpen(true)} disabled={isExporting}>
                            <Download className="mr-2 h-4 w-4" />
                            {isExporting ? 'Exporting...' : 'Export'}
                        </Button>
                    </div>
                </div>

                <div className="border rounded-md flex-1 overflow-hidden">
                    <div className="h-full overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead className="w-[120px]">Date</TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-2">
                                            Description
                                            <FilterPopover column="description" title="Description" type="text" />
                                        </div>
                                    </TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-2">
                                            Account Involved
                                            <FilterPopover column="accountInvolved" title="Account" type="text" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            Debit
                                            <FilterPopover column="debit" title="Debit" type="number" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            Credit
                                            <FilterPopover column="credit" title="Credit" type="number" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No transactions found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredData.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className={cn(
                                                "group transition-colors hover:bg-muted/50",
                                                row.isOpening ? "bg-muted/30 font-medium" : "cursor-pointer"
                                            )}
                                            onClick={() => !row.isOpening && handleRowClick(row)}
                                        >
                                            <TableCell className="whitespace-nowrap font-medium">
                                                {row.date ? format(new Date(row.date), 'dd MMM yyyy') : '-'}
                                            </TableCell>
                                            <TableCell>{row.description}</TableCell>
                                            <TableCell>
                                                {row.accountInvolvedId ? (
                                                    <span
                                                        className="hover:underline text-primary cursor-pointer flex items-center gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAccountChange?.(row.accountInvolvedId!, row.accountInvolved);
                                                        }}
                                                    >
                                                        {row.accountInvolved}
                                                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">{row.accountInvolved}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-destructive">
                                                {row.debit ? `₹${row.debit}` : ''}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-success">
                                                {row.credit ? `₹${row.credit}` : ''}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold">
                                                ₹{row.balance}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Export Ledger</DialogTitle>
                            <DialogDescription>
                                Choose which transactions you want to export to Excel.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Button onClick={() => handleExport('current')} className="w-full justify-start" variant="outline">
                                <Filter className="mr-2 h-4 w-4" />
                                Export Current View (Filtered)
                            </Button>
                            <Button onClick={() => handleExport('all')} className="w-full justify-start" variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Export All History
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <TransactionDialog
                    open={transactionDialogOpen}
                    onOpenChange={setTransactionDialogOpen}
                    transaction={editingTransaction}
                    onSuccess={() => {
                        setEditingTransaction(null);
                        refetch();
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
