import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useGetAccounts, useImportTransactions } from '../hooks/useQueries';
import { Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import api from '@/lib/api';

interface ImportTransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImportTransactionDialog({ open, onOpenChange }: ImportTransactionDialogProps) {
    const { data: accounts } = useGetAccounts();
    const importTransactions = useImportTransactions();

    const [accountId, setAccountId] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/transactions/template/download', {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Transaction_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        if (!accountId || !file) {
            toast.error('Please select an account and a file');
            return;
        }

        try {
            await importTransactions.mutateAsync({ accountId, file });
            toast.success('Transactions imported successfully');
            onOpenChange(false);
            setFile(null);
            setAccountId('');
        } catch (error) {
            toast.error('Failed to import transactions');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Import Transactions</DialogTitle>
                    <DialogDescription>
                        Import transactions from an Excel file. Download the template to see the required format.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>1. Download Template</Label>
                        <div className="text-sm text-muted-foreground mb-2">
                            Use this template to format your transactions correctly.
                        </div>
                        <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
                            <Download className="mr-2 h-4 w-4" />
                            Download Excel Template
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label>2. Select Account</Label>
                        <div className="text-sm text-muted-foreground mb-2">
                            Select the account these transactions belong to (e.g. Bank Account, Credit Card).
                        </div>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Account" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts?.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id.toString()}>
                                        {acc.name} ({acc.type})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>3. Upload File</Label>
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="cursor-pointer"
                            />
                        </div>
                        {file && (
                            <div className="flex items-center gap-2 text-sm text-primary mt-2">
                                <FileSpreadsheet className="h-4 w-4" />
                                {file.name}
                            </div>
                        )}
                    </div>

                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                            New categories found in the Excel file will be automatically created as Expense accounts.
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={!accountId || !file || importTransactions.isPending}
                    >
                        {importTransactions.isPending ? (
                            <>Importing...</>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Import Transactions
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
