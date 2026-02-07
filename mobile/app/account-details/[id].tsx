import { View, Text, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGetAccounts, useGetTransactions } from '../../src/hooks/useQueries';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function AccountDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const accountId = Number(id);

    const { data: accounts } = useGetAccounts();
    const { data: transactions, isLoading: loadingTransactions } = useGetTransactions();

    const account = accounts?.find(a => a.id === accountId);

    // Filter transactions for this account
    const accountTransactions = transactions?.filter(t =>
        t.splits.some(s => s.accountId === accountId)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    if (!account) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <Text className="text-onSurfaceVariant">Account not found</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-primary-400">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderTransactionItem = ({ item }: { item: any }) => {
        const split = item.splits.find((s: any) => s.accountId === accountId);
        const amount = split ? Number(split.amount) : 0;
        const isIncome = amount > 0; // For Asset accounts: Debit (+) is increase, Credit (-) is decrease.
        // Wait, backend stores amount as signed string.
        // For Asset: Debit is positive (increase), Credit is negative (decrease).
        // For Liability: Credit is negative (increase debt?), Debit is positive (decrease debt?).
        // Let's stick to: Positive amount = Green, Negative amount = Red.

        return (
            <TouchableOpacity
                className="flex-row items-center justify-between py-3 px-4 border-b border-outline bg-surface first:rounded-t-2xl last:rounded-b-2xl last:border-b-0 mb-[1px]"
                onPress={() => router.push(`/edit-transaction/${item.id}`)}
            >
                <View className="flex-row items-center gap-3 flex-1">
                    <View className={`w-10 h-10 rounded-full items-center justify-center ${isIncome ? 'bg-emerald-500/20' : 'bg-surfaceVariant'}`}>
                        <Ionicons
                            name={isIncome ? 'arrow-down' : 'arrow-up'}
                            size={20}
                            color={isIncome ? '#10b981' : '#ef4444'}
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-onSurface font-medium text-base" numberOfLines={1}>{item.description}</Text>
                        <Text className="text-onSurfaceVariant text-xs">{format(new Date(item.date), 'MMM dd, yyyy')}</Text>
                    </View>
                </View>
                <Text className={`font-bold text-base ${isIncome ? 'text-emerald-400' : 'text-onSurface'}`}>
                    {isIncome ? '+' : ''}{formatCurrency(amount)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View className="pt-12 px-4 pb-4 flex-row items-center justify-between border-b border-outline bg-surface">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-surfaceVariant">
                    <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                </TouchableOpacity>
                <Text className="text-onSurface text-lg font-bold" numberOfLines={1}>{account.name}</Text>
                <TouchableOpacity
                    onPress={() => router.push(`/edit-account/${account.id}`)}
                    className="w-10 h-10 items-center justify-center rounded-full bg-surfaceVariant"
                >
                    <Ionicons name="create-outline" size={22} color="#3b82f6" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Balance Card */}
                <View className="items-center py-8 mb-6 bg-surface rounded-3xl border border-outline">
                    <Text className="text-onSurfaceVariant text-sm uppercase tracking-wider mb-2">Current Balance</Text>
                    <Text className="text-4xl font-bold text-onSurface">{formatCurrency(Number(account.balance))}</Text>
                    <Text className="text-onSurfaceVariant text-xs mt-2 capitalize">{account.subType?.replace('-', ' ') || account.type}</Text>
                </View>

                {/* Transactions List */}
                <Text className="text-onSurface font-bold text-lg mb-4">History</Text>

                {loadingTransactions ? (
                    <ActivityIndicator color="#3b82f6" />
                ) : accountTransactions.length > 0 ? (
                    <View>
                        {accountTransactions.map(t => (
                            <View key={t.id}>{renderTransactionItem({ item: t })}</View>
                        ))}
                    </View>
                ) : (
                    <Text className="text-onSurfaceVariant italic text-center mt-4">No transactions found for this account.</Text>
                )}
            </ScrollView>
        </View>
    );
}
