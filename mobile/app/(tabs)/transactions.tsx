import { View, Text, SectionList, RefreshControl, TouchableOpacity, LayoutAnimation, Platform, UIManager, TextInput, Modal, ScrollView, Alert } from 'react-native';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useGetTransactions, useGetAccounts, useApproveTransaction, useDeleteTransaction, useBulkTransactionAction } from '../../src/hooks/useQueries';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useRouter } from 'expo-router';
import * as Haptics from '../../src/lib/haptics';
import { useColorScheme } from 'nativewind';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

import { useAlert } from '../../src/context/AlertContext';

export default function TransactionsScreen() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const [viewMode, setViewMode] = useState<'ALL' | 'DRAFTS'>('ALL');
    const { data: transactions, isLoading, refetch } = useGetTransactions(viewMode === 'DRAFTS' ? 'DRAFT' : 'COMPLETED');
    const { data: accounts } = useGetAccounts();
    const approveTransaction = useApproveTransaction();
    const deleteTransaction = useDeleteTransaction();
    const bulkAction = useBulkTransactionAction();
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const toggleSelected = useCallback((id: number) => {
        Haptics.selectionAsync();
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }, []);

    const handleBulkVoid = useCallback(() => {
        if (selectedIds.length === 0) return;
        showAlert(
            'Move to trash?',
            `${selectedIds.length} transaction${selectedIds.length > 1 ? 's' : ''} can be restored from Trash.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Move to trash',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await bulkAction.mutateAsync({ ids: selectedIds, action: 'void' });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setSelectedIds([]);
                        } catch (error) {
                            showAlert('Error', 'Could not move the selected transactions to trash.');
                        }
                    },
                },
            ]
        );
    }, [bulkAction, selectedIds, showAlert]);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [refreshing, setRefreshing] = useState(false);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER'>('ALL');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

    useEffect(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [transactions, searchQuery, filterType, minAmount, maxAmount, startDate, endDate, selectedAccountId]);

    const onRefresh = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleApprove = async (id: number) => {
        try {
            await approveTransaction.mutateAsync(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            showAlert("Error", "Failed to approve transaction");
        }
    };

    const handleDelete = (id: number) => {
        showAlert(
            "Delete Transaction",
            "Are you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTransaction.mutateAsync(id);
                        } catch (error) {
                            showAlert("Error", "Failed to delete transaction");
                        }
                    }
                }
            ]
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const filteredTransactions = useMemo(() => {
        if (!transactions) return [];

        return transactions.filter(t => {
            // 1. Search
            const matchesSearch = !searchQuery || (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());

            // 2. Type
            let matchesType = true;
            if (filterType !== 'ALL') {
                const hasIncome = t.splits.some(s => s.account?.type === 'INCOME');
                const hasExpense = t.splits.some(s => s.account?.type === 'EXPENSE');

                if (filterType === 'INCOME') matchesType = hasIncome;
                else if (filterType === 'EXPENSE') matchesType = hasExpense;
                else if (filterType === 'TRANSFER') matchesType = !hasIncome && !hasExpense;
            }

            // 3. Amount
            const totalAmount = t.splits.reduce((sum, split) => {
                const amt = Number(split.amount);
                return amt > 0 ? sum + amt : sum;
            }, 0) / 100;

            let matchesAmount = true;
            if (minAmount) matchesAmount = matchesAmount && totalAmount >= parseFloat(minAmount);
            if (maxAmount) matchesAmount = matchesAmount && totalAmount <= parseFloat(maxAmount);

            // 4. Date
            let matchesDate = true;
            const tDate = t.date.split('T')[0];
            if (startDate) matchesDate = matchesDate && tDate >= startDate;
            if (endDate) matchesDate = matchesDate && tDate <= endDate;

            // 5. Account
            let matchesAccount = true;
            if (selectedAccountId) {
                matchesAccount = t.splits.some(s => s.accountId === selectedAccountId);
            }

            return matchesSearch && matchesType && matchesAmount && matchesDate && matchesAccount;
        });
    }, [transactions, searchQuery, filterType, minAmount, maxAmount, startDate, endDate, selectedAccountId]);

    const groupedTransactions = useMemo(() => {
        const groups: { [key: string]: any[] } = {};

        filteredTransactions.forEach(tx => {
            const date = tx.date.split('T')[0]; // YYYY-MM-DD
            if (!groups[date]) groups[date] = [];
            groups[date].push(tx);
        });

        const sections = Object.keys(groups)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map(date => {
                const dayTransactions = groups[date].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                // Calculate daily totals
                let dailyIncome = 0;
                let dailyExpense = 0;

                dayTransactions.forEach(tx => {
                    const totalAmount = tx.splits.reduce((sum: number, split: any) => sum + Math.abs(Number(split.amount)), 0) / 2;
                    const isExpense = tx.splits.some((s: any) => s.account?.type === 'EXPENSE');
                    const isIncome = tx.splits.some((s: any) => s.account?.type === 'INCOME');

                    if (isIncome) dailyIncome += totalAmount;
                    if (isExpense) dailyExpense += totalAmount;
                });

                return {
                    title: date,
                    data: dayTransactions,
                    dailyIncome,
                    dailyExpense
                };
            });

        return sections;
    }, [filteredTransactions]);

    const getSectionTitle = (dateString: string) => {
        const date = parseISO(dateString);
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'MMMM d, yyyy');
    };

    const renderTransactionItem = ({ item }: { item: any }) => {
        // Calculate total amount (sum of splits)
        const totalAmount = item.splits.reduce((sum: number, split: any) => sum + Math.abs(Number(split.amount)), 0) / 2;

        // Determine type based on splits (Income, Expense, Transfer)
        const isExpense = item.splits.some((s: any) => s.account?.type === 'EXPENSE');
        const isIncome = item.splits.some((s: any) => s.account?.type === 'INCOME');
        const isSelected = selectedIds.includes(item.id);

        return (
            <TouchableOpacity
                className={`bg-surface border rounded-3xl p-4 flex-row justify-between items-center mx-4 mb-3 active:bg-surfaceVariant ${isSelected ? 'border-primary-600' : 'border-outline'}`}
                onPress={() => {
                    if (selectedIds.length > 0) {
                        toggleSelected(item.id);
                        return;
                    }
                    Haptics.selectionAsync();
                    router.push(`/edit-transaction/${item.id}`);
                }}
                onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    toggleSelected(item.id);
                }}
                activeOpacity={0.7}
            >
                <View className="flex-row items-center gap-4 flex-1">
                    <View className={`w-12 h-12 rounded-full items-center justify-center ${isIncome ? 'bg-emerald-500/10' : isExpense ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                        <Ionicons
                            name={isIncome ? 'arrow-down' : isExpense ? 'arrow-up' : 'swap-horizontal'}
                            size={20}
                            color={isIncome ? (isDark ? '#34d399' : '#036a4b') : isExpense ? (isDark ? '#f87171' : '#b91c1c') : (isDark ? '#7db4ff' : '#0374b8')}
                        />
                    </View>
                    <View className="flex-1 mr-2">
                        <Text className="text-onSurface font-semibold text-base" numberOfLines={1}>{item.description}</Text>
                        <Text className="text-onSurfaceVariant text-xs mt-1 font-medium" numberOfLines={1}>
                            {item.splits.map((s: any) => s.account?.name || 'Unassigned').join(' • ')}
                        </Text>
                    </View>
                </View>
                <View className="items-end">
                    <Text className={`font-bold text-lg ${isIncome ? 'text-secondary' : isExpense ? 'text-onSurface' : 'text-info'}`}>
                        {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(totalAmount)}
                    </Text>
                    {viewMode === 'DRAFTS' && (
                        <View className="flex-row gap-2 mt-2">
                            <TouchableOpacity
                                onPress={() => handleDelete(item.id)}
                                className="bg-red-500/20 p-2 rounded-full"
                            >
                                <Ionicons name="trash" size={16} color="#ef4444" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleApprove(item.id)}
                                className="bg-emerald-500/20 p-2 rounded-full"
                            >
                                <Ionicons name="checkmark" size={16} color="#10b981" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-background">
            <View className="pt-16 pb-2 px-4 bg-background z-10">
                <View className="flex-row justify-between items-center mb-4 px-2">
                    <Text className="text-3xl font-bold text-onSurface tracking-tight">Transactions</Text>
                    <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.selectionAsync();
                                router.push('/trash');
                            }}
                            className="w-10 h-10 rounded-full items-center justify-center border border-outline bg-surface"
                            accessibilityLabel="Open trash"
                        >
                            <Ionicons name="trash-outline" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowFilters(true)}
                            className={`w-10 h-10 rounded-full items-center justify-center border border-outline ${filterType !== 'ALL' || minAmount || maxAmount || startDate || endDate || selectedAccountId
                                ? 'bg-primary-600 border-primary-600'
                                : 'bg-surface'
                                }`}
                        >
                            <Ionicons name="options-outline" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center bg-surface rounded-3xl px-4 py-3 border border-outline mb-2">
                    <Ionicons name="search" size={20} color="#94a3b8" />
                    <TextInput
                        className="flex-1 ml-3 text-onSurface text-base"
                        placeholder="Search transactions..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                        </TouchableOpacity>
                    )}
                </View>

                {selectedIds.length > 0 && (
                    <View className="flex-row items-center justify-between bg-surface border border-primary-600/40 rounded-3xl px-4 py-2.5 mt-1">
                        <Text className="text-onSurface font-semibold">{selectedIds.length} selected</Text>
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={() => setSelectedIds([])}>
                                <Text className="text-onSurfaceVariant font-semibold text-sm">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleBulkVoid} className="bg-error px-3.5 py-2 rounded-full">
                                <Text className="text-white text-xs font-bold">Move to trash</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* View Mode Toggle */}
            <View className="px-4 mb-4">
                <View className="flex-row bg-surface rounded-xl p-1 border border-outline">
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${viewMode === 'ALL' ? 'bg-primary-600' : 'bg-transparent'}`}
                        onPress={() => setViewMode('ALL')}
                    >
                        <Text className={`font-bold ${viewMode === 'ALL' ? 'text-white' : 'text-onSurfaceVariant'}`}>All Transactions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${viewMode === 'DRAFTS' ? 'bg-primary-600' : 'bg-transparent'}`}
                        onPress={() => setViewMode('DRAFTS')}
                    >
                        <Text className={`font-bold ${viewMode === 'DRAFTS' ? 'text-white' : 'text-onSurfaceVariant'}`}>Drafts</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <SectionList
                sections={groupedTransactions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderTransactionItem}
                renderSectionHeader={({ section: { title, dailyIncome, dailyExpense } }) => (
                    <View className="px-6 py-2 bg-background/95 backdrop-blur-xl flex-row justify-between items-center mt-2 border-b border-outline">
                        <Text className="text-onSurfaceVariant text-xs font-bold uppercase tracking-widest">
                            {getSectionTitle(title)}
                        </Text>
                        <View className="flex-row gap-3">
                            {dailyIncome > 0 && (
                                <Text className="text-secondary text-xs font-medium">+{formatCurrency(dailyIncome)}</Text>
                            )}
                            {dailyExpense > 0 && (
                                <Text className="text-error text-xs font-medium">-{formatCurrency(dailyExpense)}</Text>
                            )}
                        </View>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
                }
                stickySectionHeadersEnabled={true}
                ListEmptyComponent={
                    <View className="items-center py-20">
                        <Ionicons name="documents-outline" size={48} color={isDark ? "#334155" : "#d1d5db"} />
                        <Text className="text-onSurfaceVariant mt-4 font-medium">No transactions found.</Text>
                    </View>
                }
            />

            {/* Filter Modal */}
            <Modal
                visible={showFilters}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowFilters(false)}
            >
                <View className="flex-1 bg-background">
                    <View className="flex-row justify-between items-center p-4 border-b border-outline">
                        <Text className="text-xl font-bold text-onSurface">Filters</Text>
                        <TouchableOpacity onPress={() => setShowFilters(false)}>
                            <Text className="text-primary-400 font-medium">Done</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 p-4">
                        {/* Type Filter */}
                        <Text className="text-onSurfaceVariant text-sm font-bold uppercase mb-3">Transaction Type</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {['ALL', 'INCOME', 'EXPENSE', 'TRANSFER'].map(type => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setFilterType(type as any)}
                                    className={`px-4 py-2 rounded-full border ${filterType === type
                                        ? 'bg-primary-600 border-primary-600'
                                        : 'bg-transparent border-outline'
                                        }`}
                                >
                                    <Text className={`font-medium ${filterType === type ? 'text-white' : 'text-onSurfaceVariant'}`}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Account Filter */}
                        <Text className="text-onSurfaceVariant text-sm font-bold uppercase mb-3">Account</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                            <TouchableOpacity
                                onPress={() => setSelectedAccountId(null)}
                                className={`px-4 py-2 rounded-full border mr-2 ${!selectedAccountId
                                    ? 'bg-primary-600 border-primary-600'
                                    : 'bg-transparent border-outline'
                                    }`}
                            >
                                <Text className={`font-medium ${!selectedAccountId ? 'text-white' : 'text-onSurfaceVariant'}`}>
                                    All Accounts
                                </Text>
                            </TouchableOpacity>
                            {accounts?.map(acc => (
                                <TouchableOpacity
                                    key={acc.id}
                                    onPress={() => setSelectedAccountId(acc.id)}
                                    className={`px-4 py-2 rounded-full border mr-2 ${selectedAccountId === acc.id
                                        ? 'bg-primary-600 border-primary-600'
                                        : 'bg-transparent border-outline'
                                        }`}
                                >
                                    <Text className={`font-medium ${selectedAccountId === acc.id ? 'text-white' : 'text-onSurfaceVariant'}`}>
                                        {acc.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Amount Range */}
                        <Text className="text-onSurfaceVariant text-sm font-bold uppercase mb-3">Amount Range</Text>
                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs mb-1">Min Amount</Text>
                                <TextInput
                                    className="bg-surfaceVariant border border-outline rounded-xl px-4 py-3 text-onSurface"
                                    placeholder="0"
                                    placeholderTextColor={isDark ? "#94a3b8" : "#6b7280"}
                                    keyboardType="numeric"
                                    value={minAmount}
                                    onChangeText={setMinAmount}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs mb-1">Max Amount</Text>
                                <TextInput
                                    className="bg-surfaceVariant border border-outline rounded-xl px-4 py-3 text-onSurface"
                                    placeholder="Any"
                                    placeholderTextColor={isDark ? "#94a3b8" : "#6b7280"}
                                    keyboardType="numeric"
                                    value={maxAmount}
                                    onChangeText={setMaxAmount}
                                />
                            </View>
                        </View>

                        {/* Date Range */}
                        <Text className="text-onSurfaceVariant text-sm font-bold uppercase mb-3">Date Range</Text>
                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs mb-1">Start Date (YYYY-MM-DD)</Text>
                                <TextInput
                                    className="bg-surfaceVariant border border-outline rounded-xl px-4 py-3 text-onSurface"
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={isDark ? "#94a3b8" : "#6b7280"}
                                    value={startDate}
                                    onChangeText={setStartDate}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs mb-1">End Date (YYYY-MM-DD)</Text>
                                <TextInput
                                    className="bg-surfaceVariant border border-outline rounded-xl px-4 py-3 text-onSurface"
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={isDark ? "#94a3b8" : "#6b7280"}
                                    value={endDate}
                                    onChangeText={setEndDate}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            className="bg-surfaceVariant p-4 rounded-xl items-center mt-4"
                            onPress={() => {
                                setFilterType('ALL');
                                setMinAmount('');
                                setMaxAmount('');
                                setStartDate('');
                                setEndDate('');
                                setSelectedAccountId(null);
                            }}
                        >
                            <Text className="text-error font-bold">Reset Filters</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>

            {/* Floating Action Button */}
            <TouchableOpacity
                className="absolute bottom-6 right-6 w-16 h-16 bg-primary-600 rounded-full items-center justify-center border border-outline"
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/add-transaction');
                }}
            >
                <Ionicons name="add" size={32} color="white" />
            </TouchableOpacity>
        </View>
    );
}
