import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Switch, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEditTransaction, useDeleteTransaction, useGetTransaction, useGetTransactions, useGetAccounts, useGetTransactionHistory } from '../../src/hooks/useQueries';
import DateTimePicker from '@react-native-community/datetimepicker';
import AccountSelector from '../../src/components/AccountSelector';
import { useAlert } from '../../src/context/AlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditTransactionScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const transactionId = Number(id);
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();

    const editTransaction = useEditTransaction();
    const deleteTransaction = useDeleteTransaction();

    // Try to fetch single transaction, but also fetch lists as fallback
    const { data: txSingle, isLoading: isLoadingSingle } = useGetTransaction(transactionId);
    const { data: drafts, isLoading: isLoadingDrafts } = useGetTransactions('DRAFT');
    const { data: completed, isLoading: isLoadingCompleted } = useGetTransactions('COMPLETED');
    const { data: history } = useGetTransactionHistory(transactionId);

    // Use loose equality (==) for ID check to handle string/number mismatches
    // PRIORITIZE the source that has splits!
    const txFromSingle = txSingle?.splits ? txSingle : null;
    const txFromDrafts = drafts?.find(t => t.id == transactionId && t.splits);
    const txFromCompleted = completed?.find(t => t.id == transactionId && t.splits);

    const tx = txFromSingle || txFromDrafts || txFromCompleted ||
        // Fallback to ones without splits if absolutely necessary (but likely won't work for editing)
        txSingle || drafts?.find(t => t.id == transactionId) || completed?.find(t => t.id == transactionId);

    const isLoading = isLoadingSingle || isLoadingDrafts || isLoadingCompleted;

    const { data: accounts } = useGetAccounts();

    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isAdvanced, setIsAdvanced] = useState(false);

    // Simple Mode State
    const [amount, setAmount] = useState('');
    const [fromAccountId, setFromAccountId] = useState<number | null>(null);
    const [toAccountId, setToAccountId] = useState<number | null>(null);

    // Advanced Mode State
    const [splits, setSplits] = useState<{ accountId: number | null; debit: string; credit: string }[]>([
        { accountId: null, debit: '', credit: '' },
        { accountId: null, debit: '', credit: '' },
    ]);

    // Load transaction data
    useEffect(() => {
        if (tx && tx.splits) {
            setDescription(tx.description);
            setDate(new Date(tx.date));

            // Determine if Simple or Advanced
            // Simple = 2 splits, one positive, one negative, same absolute amount
            const isSimple = tx.splits.length === 2 &&
                Math.abs(Number(tx.splits[0].amount)) === Math.abs(Number(tx.splits[1].amount));

            if (isSimple) {
                setIsAdvanced(false);
                const positiveSplit = tx.splits.find(s => Number(s.amount) > 0);
                const negativeSplit = tx.splits.find(s => Number(s.amount) < 0);

                if (positiveSplit) {
                    setToAccountId(positiveSplit.accountId);
                    setAmount((Number(positiveSplit.amount) / 100).toString());
                }
                if (negativeSplit) {
                    setFromAccountId(negativeSplit.accountId);
                }
            } else {
                setIsAdvanced(true);
                const loadedSplits = tx.splits.map(s => {
                    const amt = Number(s.amount);
                    return {
                        accountId: s.accountId,
                        debit: amt > 0 ? (amt / 100).toString() : '',
                        credit: amt < 0 ? (Math.abs(amt) / 100).toString() : '',
                    };
                });
                setSplits(loadedSplits);
            }
        }
    }, [tx]);

    const handleAddSplit = () => {
        setSplits([...splits, { accountId: null, debit: '', credit: '' }]);
    };

    const handleRemoveSplit = (index: number) => {
        if (splits.length > 2) {
            const newSplits = [...splits];
            newSplits.splice(index, 1);
            setSplits(newSplits);
        }
    };

    const updateSplit = (index: number, field: 'accountId' | 'debit' | 'credit', value: any) => {
        const newSplits = [...splits];
        // @ts-ignore
        newSplits[index][field] = value;
        setSplits(newSplits);
    };

    const handleSave = async (targetStatus?: 'DRAFT' | 'COMPLETED') => {
        if (!description) {
            showAlert("Error", "Please enter a description");
            return;
        }

        let finalSplits: { accountId: number; amount: number }[] = [];

        if (!isAdvanced) {
            if (!amount || !fromAccountId || !toAccountId) {
                showAlert("Error", "Please fill in all fields");
                return;
            }
            const amountValue = Math.round(parseFloat(amount) * 100);
            if (isNaN(amountValue) || amountValue <= 0) {
                showAlert("Error", "Invalid amount");
                return;
            }

            finalSplits.push({ accountId: toAccountId, amount: amountValue });
            finalSplits.push({ accountId: fromAccountId, amount: -amountValue });
        } else {
            let totalDebit = 0;
            let totalCredit = 0;
            const validSplits = splits.filter(s => s.accountId && (s.debit || s.credit));

            if (validSplits.length < 2) {
                showAlert("Error", "Transaction must have at least 2 splits");
                return;
            }

            for (const split of validSplits) {
                const debit = split.debit ? Math.round(parseFloat(split.debit) * 100) : 0;
                const credit = split.credit ? Math.round(parseFloat(split.credit) * 100) : 0;
                totalDebit += debit;
                totalCredit += credit;

                finalSplits.push({
                    accountId: split.accountId!,
                    amount: debit - credit,
                });
            }

            if (totalDebit !== totalCredit) {
                showAlert("Error", `Debits (${totalDebit / 100}) must equal Credits (${totalCredit / 100})`);
                return;
            }
        }

        try {
            await editTransaction.mutateAsync({
                id: transactionId,
                description,
                date,
                splits: finalSplits,
                status: targetStatus // Pass status if provided
            });
            router.back();
        } catch (error) {
            console.error("[EditTransaction] Mutation failed:", error);
            showAlert("Error", "Failed to update transaction");
        }
    };

    const handleDelete = () => {
        showAlert(
            "Delete Transaction",
            "Are you sure you want to delete this transaction?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTransaction.mutateAsync(transactionId);
                            router.back();
                        } catch (error) {
                            console.error(error);
                            showAlert("Error", "Failed to delete transaction");
                        }
                    }
                }
            ]
        );
    };

    if (isLoading && !tx) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-onSurfaceVariant mt-4">Loading transaction...</Text>
            </View>
        );
    }

    const isDraft = tx?.status === 'DRAFT';

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View style={{ paddingTop: insets.top }} className="pb-4 px-4 bg-surface border-b border-outline">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-surfaceVariant">
                        <Text className="text-primary-500 font-medium text-base">Cancel</Text>
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-onSurface">Edit Transaction</Text>
                    <View className="w-16" />
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>

                    {/* Amount Input - Focal Point */}
                    {!isAdvanced && (
                        <View className="items-center mb-8">
                            <Text className="text-onSurfaceVariant text-sm font-medium mb-2 uppercase tracking-wide">Amount</Text>
                            <View className="flex-row items-center justify-center">
                                <Text className="text-4xl text-onSurface font-bold mr-1">₹</Text>
                                <TextInput
                                    className="text-5xl text-onSurface font-bold min-w-[100px] text-center p-0"
                                    placeholder="0"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="numeric"
                                    value={amount}
                                    onChangeText={setAmount}
                                />
                            </View>
                        </View>
                    )}

                    {/* Details Card */}
                    <View className="bg-surface rounded-2xl border border-outline overflow-hidden mb-6">
                        {/* Description */}
                        <View className="p-4 border-b border-outline">
                            <Text className="text-onSurfaceVariant text-xs font-bold uppercase mb-2">Description</Text>
                            <TextInput
                                className="text-onSurface text-base p-0"
                                placeholder="What is this for?"
                                placeholderTextColor="#9ca3af"
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>

                        {/* Date */}
                        <TouchableOpacity
                            className="p-4 flex-row items-center justify-between active:bg-surfaceVariant"
                            onPress={() => setShowDatePicker(true)}
                        >
                            <View>
                                <Text className="text-onSurfaceVariant text-xs font-bold uppercase mb-1">Date</Text>
                                <Text className="text-onSurface text-base">{date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</Text>
                            </View>
                            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            onChange={(event: any, selectedDate?: Date) => {
                                setShowDatePicker(false);
                                if (selectedDate) setDate(selectedDate);
                            }}
                        />
                    )}

                    {/* Simple Mode Accounts */}
                    {!isAdvanced ? (
                        <View className="space-y-4 mb-8">
                            <View className="bg-surface rounded-2xl border border-outline p-4">
                                <AccountSelector
                                    label="From Account (Credit)"
                                    placeholder="Select source account..."
                                    accounts={accounts}
                                    selectedAccountId={fromAccountId}
                                    onSelect={setFromAccountId}
                                />

                                <View className="items-center -my-3 z-10">
                                    <View className="bg-surface p-1.5 rounded-full border border-outline shadow-sm">
                                        <Ionicons name="arrow-down" size={16} color="#6b7280" />
                                    </View>
                                </View>

                                <View className="mt-2">
                                    <AccountSelector
                                        label="To Account (Debit)"
                                        placeholder="Select destination account..."
                                        accounts={accounts}
                                        selectedAccountId={toAccountId}
                                        onSelect={setToAccountId}
                                    />
                                </View>
                            </View>
                        </View>
                    ) : (
                        // Advanced Mode Splits
                        <View className="space-y-4 mb-8">
                            {splits.map((split, index) => (
                                <View key={index} className="bg-surface p-4 rounded-2xl border border-outline space-y-3">
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-onSurface font-bold text-sm">Split {index + 1}</Text>
                                        {splits.length > 2 && (
                                            <TouchableOpacity onPress={() => handleRemoveSplit(index)}>
                                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <AccountSelector
                                        accounts={accounts}
                                        selectedAccountId={split.accountId}
                                        onSelect={(id) => updateSplit(index, 'accountId', id)}
                                        placeholder="Select Account"
                                    />

                                    <View className="flex-row gap-3">
                                        <View className="flex-1">
                                            <Text className="text-onSurfaceVariant text-xs mb-1 ml-1 uppercase font-bold">Debit (+)</Text>
                                            <TextInput
                                                className="bg-background border border-outline rounded-xl px-3 py-2.5 text-onSurface"
                                                placeholder="0.00"
                                                placeholderTextColor="#9ca3af"
                                                keyboardType="numeric"
                                                value={split.debit}
                                                onChangeText={(val) => updateSplit(index, 'debit', val)}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-onSurfaceVariant text-xs mb-1 ml-1 uppercase font-bold">Credit (-)</Text>
                                            <TextInput
                                                className="bg-background border border-outline rounded-xl px-3 py-2.5 text-onSurface"
                                                placeholder="0.00"
                                                placeholderTextColor="#9ca3af"
                                                keyboardType="numeric"
                                                value={split.credit}
                                                onChangeText={(val) => updateSplit(index, 'credit', val)}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}

                            <TouchableOpacity
                                className="flex-row items-center justify-center bg-surfaceVariant/50 p-4 rounded-2xl border border-outline border-dashed"
                                onPress={handleAddSplit}
                            >
                                <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
                                <Text className="text-primary-500 font-bold ml-2">Add Split</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Mode Toggle */}
                    <View className="flex-row justify-between items-center mb-8 px-2">
                        <Text className="text-onSurfaceVariant font-medium">Advanced Mode (Multi-Split)</Text>
                        <Switch
                            value={isAdvanced}
                            onValueChange={(value) => {
                                setIsAdvanced(value);
                                if (value) {
                                    if (amount && fromAccountId && toAccountId) {
                                        setSplits([
                                            { accountId: toAccountId, debit: amount, credit: '' },
                                            { accountId: fromAccountId, debit: '', credit: amount },
                                        ]);
                                    }
                                } else {
                                    const debitSplit = splits.find(s => s.debit && parseFloat(s.debit) > 0);
                                    const creditSplit = splits.find(s => s.credit && parseFloat(s.credit) > 0);

                                    if (debitSplit && creditSplit) {
                                        setAmount(debitSplit.debit);
                                        setToAccountId(debitSplit.accountId);
                                        setFromAccountId(creditSplit.accountId);
                                    }
                                }
                            }}
                            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                            thumbColor={'#ffffff'}
                        />
                    </View>

                    {/* Audit history */}
                    {history && history.length > 0 && (
                        <View className="mb-6 bg-surface border border-outline rounded-3xl p-4">
                            <Text className="text-onSurface font-bold mb-2">History</Text>
                            {history.map((entry) => (
                                <View key={entry.id} className="flex-row items-center justify-between py-1.5">
                                    <View className="flex-row items-center">
                                        <View className="w-2 h-2 rounded-full bg-primary-500 mr-2" />
                                        <Text className="text-onSurface text-sm font-medium">{entry.action}</Text>
                                    </View>
                                    <Text className="text-onSurfaceVariant text-xs">
                                        {new Date(entry.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity
                        className="mb-24 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl items-center flex-row justify-center"
                        onPress={handleDelete}
                    >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
                        <Text className="text-red-500 font-bold text-base">Delete Transaction</Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Footer Actions */}
            <View
                style={{ paddingBottom: Math.max(insets.bottom, 20) }}
                className="absolute bottom-0 left-0 right-0 bg-surface border-t border-outline px-4 pt-4 shadow-lg"
            >
                {isDraft ? (
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => handleSave('DRAFT')}
                            disabled={editTransaction.isPending}
                            className="flex-1 py-4 rounded-2xl items-center flex-row justify-center bg-surfaceVariant border border-outline"
                        >
                            <Text className="text-onSurface font-bold text-lg">Save Draft</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleSave('COMPLETED')}
                            disabled={editTransaction.isPending}
                            className={`flex-1 py-4 rounded-2xl items-center flex-row justify-center ${editTransaction.isPending ? 'bg-gray-300' : 'bg-primary-600'}`}
                        >
                            {editTransaction.isPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 8 }} />
                                    <Text className="text-white font-bold text-lg">Approve</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => handleSave()}
                        disabled={editTransaction.isPending}
                        className={`w-full py-4 rounded-2xl items-center flex-row justify-center ${editTransaction.isPending ? 'bg-gray-300' : 'bg-primary-600'}`}
                    >
                        {editTransaction.isPending ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text className="text-white font-bold text-lg">Save Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
