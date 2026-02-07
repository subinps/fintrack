import { Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useGetLedger, useGetAccounts } from '../../src/hooks/useQueries';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { View } from 'react-native'; // Keep View for other components

export default function LedgerScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const accountId = Number(id);

    const { data: accounts } = useGetAccounts();
    const account = accounts?.find(a => a.id === accountId);

    const { data: ledgerData, isLoading, refetch } = useGetLedger(accountId);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (isLoading || !account) {
        return (
            <View className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <Stack.Screen options={{
                headerShown: false,
            }} />

            {/* Header with Back Button */}
            <View className="px-4 py-2 flex-row items-center">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 rounded-full bg-surfaceVariant items-center justify-center mr-4"
                >
                    <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                </TouchableOpacity>
                <Text className="text-onSurface text-xl font-bold flex-1" numberOfLines={1}>{account.name}</Text>
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/account-history/[id]', params: { id: accountId } })}
                        className="w-10 h-10 rounded-full bg-surfaceVariant items-center justify-center"
                    >
                        <Ionicons name="time-outline" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id: accountId } })}
                        className="w-10 h-10 rounded-full bg-surfaceVariant items-center justify-center"
                    >
                        <Ionicons name="create-outline" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Account Summary Header */}
            <View className="px-4 pt-4 pb-4">
                <View className="bg-surface border border-outline rounded-2xl p-6">
                    <Text className="text-onSurfaceVariant text-xs font-medium uppercase tracking-wider mb-2">Current Balance</Text>
                    <Text className={`text-4xl font-bold ${account.type === 'LIABILITY' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(Number(account.balance) / 100)}
                    </Text>
                    <View className="flex-row items-center mt-2">
                        <View className={`w-2 h-2 rounded-full mr-2 ${account.type === 'LIABILITY' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                        <Text className="text-onSurfaceVariant text-sm capitalize font-medium">{account.subType?.replace('-', ' ') || account.type}</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={ledgerData || []}
                keyExtractor={(item) => item.id.toString()}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
                }
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                ItemSeparatorComponent={() => <View className="h-3" />}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <Ionicons name="documents-outline" size={48} color="#374151" />
                        <Text className="text-onSurfaceVariant mt-4 font-medium">No transactions found</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const debit = item.debit ? parseFloat(item.debit) : 0;
                    const credit = item.credit ? parseFloat(item.credit) : 0;

                    let colorClass = 'text-onSurface';
                    let sign = '';
                    let displayAmount = 0;

                    if (account.type === 'LIABILITY' || account.type === 'INCOME') {
                        if (credit > 0) {
                            colorClass = 'text-red-400';
                            sign = '+';
                            displayAmount = credit;
                        } else if (debit > 0) {
                            colorClass = 'text-emerald-400';
                            sign = '-';
                            displayAmount = debit;
                        }
                    } else {
                        if (debit > 0) {
                            colorClass = 'text-emerald-400';
                            sign = '+';
                            displayAmount = debit;
                        } else if (credit > 0) {
                            colorClass = 'text-red-400';
                            sign = '-';
                            displayAmount = credit;
                        }
                    }

                    return (
                        <TouchableOpacity
                            className="bg-surface border border-outline rounded-xl p-4 flex-row justify-between items-center active:bg-surfaceVariant"
                            onPress={() => {
                                if (item.transactionId) {
                                    router.push({ pathname: '/edit-transaction/[id]', params: { id: item.transactionId } });
                                }
                            }}
                            disabled={!item.transactionId}
                        >
                            <View className="flex-1 mr-4">
                                <Text className="text-onSurface font-semibold text-base mb-1" numberOfLines={1}>{item.description}</Text>
                                <View className="flex-row items-center">
                                    <Text className="text-onSurfaceVariant text-xs font-medium">{formatDate(item.date)}</Text>
                                    {item.accountInvolved && (
                                        <>
                                            <Text className="text-gray-600 text-xs mx-1">•</Text>
                                            <Text className="text-onSurfaceVariant text-xs" numberOfLines={1}>{item.accountInvolved}</Text>
                                        </>
                                    )}
                                </View>
                            </View>
                            <View className="items-end">
                                <Text className={`font-bold text-lg ${colorClass}`}>
                                    {sign}{formatCurrency(displayAmount)}
                                </Text>
                                {item.balance !== undefined && (
                                    <Text className="text-onSurfaceVariant text-xs mt-1 font-medium">
                                        Bal: {formatCurrency(parseFloat(item.balance))}
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </SafeAreaView>
    );
}
