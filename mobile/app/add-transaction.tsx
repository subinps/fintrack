import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Switch, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAddTransaction, useGetAccounts, useAddAccount } from '../src/hooks/useQueries';
import DateTimePicker from '@react-native-community/datetimepicker';
import AccountSelector from '../src/components/AccountSelector';
import { useAlert } from '../src/context/AlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddTransactionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const addTransaction = useAddTransaction();
    const addAccount = useAddAccount();
    const { data: accounts } = useGetAccounts();
    const { showAlert } = useAlert();

    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isAdvanced, setIsAdvanced] = useState(false);

    // Simple Mode State
    const [amount, setAmount] = useState('');
    const [fromAccountId, setFromAccountId] = useState<number | null>(null); // Credit
    const [toAccountId, setToAccountId] = useState<number | null>(null);   // Debit
    const [units, setUnits] = useState(''); // For Investment Accounts

    // Advanced Mode State
    const [splits, setSplits] = useState<{ accountId: number | null; debit: string; credit: string; units: string }[]>([
        { accountId: null, debit: '', credit: '', units: '' },
        { accountId: null, debit: '', credit: '', units: '' },
    ]);

    const isInvestmentAccount = (accountId: number | null) => {
        if (!accountId || !accounts) return false;
        const account = accounts.find(a => a.id === accountId);
        return account?.type === 'ASSET' && ['mutual-fund', 'stock', 'crypto', 'investment', 'gold', 'bond', 'etf'].includes(account.subType?.toLowerCase() || '');
    };

    const handleAddSplit = () => {
        setSplits([...splits, { accountId: null, debit: '', credit: '', units: '' }]);
    };

    const handleRemoveSplit = (index: number) => {
        if (splits.length > 2) {
            const newSplits = [...splits];
            newSplits.splice(index, 1);
            setSplits(newSplits);
        }
    };

    const updateSplit = (index: number, field: 'accountId' | 'debit' | 'credit' | 'units', value: any) => {
        const newSplits = [...splits];
        // @ts-ignore
        newSplits[index][field] = value;
        setSplits(newSplits);
    };

    const handleSave = async () => {
        if (!description) {
            showAlert("Error", "Please enter a description");
            return;
        }

        let finalSplits: { accountId: number; amount: number; units?: number }[] = [];

        if (!isAdvanced) {
            // Simple Mode Validation
            if (!amount || !fromAccountId || !toAccountId) {
                showAlert("Error", "Please fill in all fields");
                return;
            }
            const amountValue = Math.round(parseFloat(amount) * 100);
            if (isNaN(amountValue) || amountValue <= 0) {
                showAlert("Error", "Invalid amount");
                return;
            }

            // Handle Units for Simple Mode
            const fromIsInvestment = isInvestmentAccount(fromAccountId);
            const toIsInvestment = isInvestmentAccount(toAccountId);
            // Ensure units are positive magnitude, sign is determined by direction
            const unitsValue = units ? Math.abs(parseFloat(units)) : null;
            const fromAccount = accounts?.find(a => a.id === fromAccountId);

            if (fromIsInvestment && unitsValue) {
                const avgPrice = fromAccount?.averageBuyPrice;

                // Allow 0 as valid price (e.g. airdrop)
                if (avgPrice !== undefined && avgPrice !== null) {
                    // WAC Logic
                    const costBasis = Math.round(unitsValue * avgPrice);
                    const saleAmount = amountValue;
                    const realizedGain = saleAmount - costBasis;

                    // 1. To Account (Bank) - Debit
                    finalSplits.push({
                        accountId: toAccountId!,
                        amount: saleAmount,
                        units: toIsInvestment && unitsValue ? unitsValue : undefined
                    });

                    // 2. From Account (Investment) - Credit Cost Basis
                    finalSplits.push({
                        accountId: fromAccountId!,
                        amount: -costBasis,
                        units: -unitsValue
                    });

                    // 3. Realized Gain/Loss
                    if (realizedGain !== 0) {
                        let rglAccount = accounts?.find(a => a.name === 'Realized Gain/Loss');
                        if (!rglAccount) {
                            try {
                                // @ts-ignore
                                rglAccount = await addAccount.mutateAsync({
                                    name: 'Realized Gain/Loss',
                                    type: realizedGain > 0 ? 'INCOME' : 'EXPENSE',
                                    subType: 'Investment'
                                });
                            } catch (err) {
                                showAlert("Error", "Failed to create Realized Gain/Loss account");
                                return;
                            }
                        }

                        if (rglAccount) {
                            finalSplits.push({
                                accountId: rglAccount.id,
                                amount: -realizedGain
                            });
                        }
                    }
                } else {
                    // Fallback to Standard Logic
                    finalSplits.push({
                        accountId: toAccountId!,
                        amount: amountValue,
                        units: toIsInvestment && unitsValue ? unitsValue : undefined
                    });   // Debit (+)

                    finalSplits.push({
                        accountId: fromAccountId!,
                        amount: -amountValue,
                        units: fromIsInvestment && unitsValue ? -unitsValue : undefined // Selling investment
                    }); // Credit (-)
                }
            } else {
                // Standard Logic
                finalSplits.push({
                    accountId: toAccountId!,
                    amount: amountValue,
                    units: toIsInvestment && unitsValue ? unitsValue : undefined
                });   // Debit (+)

                finalSplits.push({
                    accountId: fromAccountId!,
                    amount: -amountValue,
                    units: fromIsInvestment && unitsValue ? -unitsValue : undefined // Selling investment
                }); // Credit (-)
            }
        } else {
            // Advanced Mode Validation
            let totalDebit = 0;
            let totalCredit = 0;

            // FIX: Allow splits with units even if debit/credit is empty (0 amount)
            const validSplits = splits.filter(s => s.accountId && (s.debit || s.credit || s.units));

            if (validSplits.length < 2) {
                showAlert("Error", "Transaction must have at least 2 splits");
                return;
            }

            for (const split of validSplits) {
                const debit = split.debit ? Math.round(parseFloat(split.debit) * 100) : 0;
                const credit = split.credit ? Math.round(parseFloat(split.credit) * 100) : 0;
                const amount = debit - credit;

                let splitUnits = split.units ? parseFloat(split.units) : undefined;

                // Auto-align unit sign with amount sign for ASSET accounts
                if (splitUnits !== undefined && isInvestmentAccount(split.accountId)) {
                    if (amount !== 0) {
                        splitUnits = Math.sign(amount) * Math.abs(splitUnits);
                    }
                }

                totalDebit += debit;
                totalCredit += credit;

                finalSplits.push({
                    accountId: split.accountId!,
                    amount: amount,
                    units: splitUnits
                });
            }

            if (totalDebit !== totalCredit) {
                showAlert("Error", `Debits (${totalDebit / 100}) must equal Credits (${totalCredit / 100})`);
                return;
            }
        }

        try {
            // Determine type and category
            let type = 'EXPENSE';
            if (finalSplits.length === 2) {
                const source = accounts?.find(a => a.id === finalSplits.find(s => s.amount < 0)?.accountId);
                const dest = accounts?.find(a => a.id === finalSplits.find(s => s.amount > 0)?.accountId);

                if (source?.type === 'ASSET' && dest?.type === 'EXPENSE') type = 'EXPENSE';
                else if (source?.type === 'INCOME' && dest?.type === 'ASSET') type = 'INCOME';
                else if (source?.type === 'ASSET' && dest?.type === 'ASSET') type = 'TRANSFER';
                else if (source?.type === 'LIABILITY' && dest?.type === 'EXPENSE') type = 'EXPENSE'; // Credit Card
                else if (source?.type === 'ASSET' && dest?.type === 'LIABILITY') type = 'TRANSFER'; // Paying Debt
            }

            await addTransaction.mutateAsync({
                description,
                date,
                splits: finalSplits,
                type,
                category: 'General', // Default for now
                notes: isAdvanced ? 'Advanced Transaction' : undefined
            });
            router.back();
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to save transaction");
        }
    };

    const showSimpleUnitsInput = isInvestmentAccount(fromAccountId) || isInvestmentAccount(toAccountId);

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View style={{ paddingTop: insets.top }} className="pb-4 px-4 bg-surface border-b border-outline">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-surfaceVariant">
                        <Text className="text-primary-500 font-medium text-base">Cancel</Text>
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-onSurface">New Transaction</Text>
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
                                    autoFocus
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

                            {/* Units Input for Investment Accounts */}
                            {showSimpleUnitsInput && (
                                <View className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                                    <View className="flex-row items-center mb-2">
                                        <Ionicons name="trending-up" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
                                        <Text className="text-blue-500 font-bold text-sm">Investment Details</Text>
                                    </View>
                                    <View>
                                        <Text className="text-onSurfaceVariant text-xs mb-2">Units (Purchased/Sold)</Text>
                                        <TextInput
                                            className="bg-surface border border-outline rounded-xl px-4 py-3 text-onSurface font-medium"
                                            placeholder="0.00"
                                            placeholderTextColor="#9ca3af"
                                            keyboardType="numeric"
                                            value={units}
                                            onChangeText={setUnits}
                                        />
                                    </View>
                                </View>
                            )}
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

                                    {/* Units Input if Investment Account */}
                                    {isInvestmentAccount(split.accountId) && (
                                        <View>
                                            <Text className="text-onSurfaceVariant text-xs mb-1 ml-1 uppercase font-bold">Units</Text>
                                            <TextInput
                                                className="bg-background border border-outline rounded-xl px-3 py-2.5 text-onSurface"
                                                placeholder="0.00"
                                                placeholderTextColor="#9ca3af"
                                                keyboardType="numeric"
                                                value={split.units}
                                                onChangeText={(val) => updateSplit(index, 'units', val)}
                                            />
                                        </View>
                                    )}

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
                    <View className="flex-row justify-between items-center mb-24 px-2">
                        <Text className="text-onSurfaceVariant font-medium">Advanced Mode (Multi-Split)</Text>
                        <Switch
                            value={isAdvanced}
                            onValueChange={setIsAdvanced}
                            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                            thumbColor={'#ffffff'}
                        />
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Footer Save Button */}
            <View
                style={{ paddingBottom: Math.max(insets.bottom, 20) }}
                className="absolute bottom-0 left-0 right-0 bg-surface border-t border-outline px-4 pt-4 shadow-lg"
            >
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={addTransaction.isPending}
                    className={`w-full py-4 rounded-2xl items-center flex-row justify-center ${addTransaction.isPending ? 'bg-gray-300' : 'bg-primary-600'}`}
                >
                    {addTransaction.isPending ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 8 }} />
                            <Text className="text-white font-bold text-lg">Save Transaction</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}
