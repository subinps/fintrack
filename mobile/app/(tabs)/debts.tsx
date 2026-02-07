import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGetDebts, useGetReceivables } from '../../src/hooks/useQueries';
import { Account } from '../../src/hooks/useQueries';

export default function DebtsScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'DEBT' | 'RECEIVABLE'>('DEBT');

    const { data: debts, isLoading: loadingDebts, refetch: refetchDebts } = useGetDebts();
    const { data: receivables, isLoading: loadingReceivables, refetch: refetchReceivables } = useGetReceivables();

    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([refetchDebts(), refetchReceivables()]);
        } finally {
            setRefreshing(false);
        }
    }, [refetchDebts, refetchReceivables]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const currentData = activeTab === 'DEBT' ? debts : receivables;
    const isLoading = activeTab === 'DEBT' ? loadingDebts : loadingReceivables;

    const totalAmount = currentData?.reduce((sum, item) => sum + Number(item.balance), 0) || 0;

    const renderItem = ({ item }: { item: Account }) => (
        <TouchableOpacity
            className="flex-row justify-between items-center p-4 bg-card border border-outline mx-4 mb-3 rounded-2xl active:bg-surfaceVariant"
            onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: item.id } })}
            activeOpacity={0.7}
        >
            <View className="flex-row items-center gap-4">
                <View className={`w-12 h-12 rounded-full items-center justify-center ${activeTab === 'DEBT' ? 'bg-red-500/10' : 'bg-emerald-500/10'
                    }`}>
                    <Ionicons
                        name={activeTab === 'DEBT' ? 'trending-down' : 'trending-up'}
                        size={24}
                        color={activeTab === 'DEBT' ? '#ef4444' : '#10b981'}
                    />
                </View>
                <View>
                    <Text className="text-onSurface font-bold text-lg">{item.name}</Text>
                    <Text className="text-onSurfaceVariant text-sm capitalize font-medium">{item.subType || (activeTab === 'DEBT' ? 'Liability' : 'Asset')}</Text>
                </View>
            </View>
            <View className="items-end">
                <Text className={`font-bold text-lg ${activeTab === 'DEBT' ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                    {formatCurrency(Number(item.balance))}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </View>
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View className="pt-14 pb-4 px-4 bg-background border-b border-outline">
                <Text className="text-3xl font-bold text-onSurface mb-4">Debts & Receivables</Text>

                {/* Toggle */}
                <View className="flex-row bg-card/50 p-1 rounded-xl border border-outline">
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'DEBT' ? 'bg-card border border-outline' : ''}`}
                        onPress={() => setActiveTab('DEBT')}
                    >
                        <Text className={`font-bold ${activeTab === 'DEBT' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Debts</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'RECEIVABLE' ? 'bg-card border border-outline' : ''}`}
                        onPress={() => setActiveTab('RECEIVABLE')}
                    >
                        <Text className={`font-bold ${activeTab === 'RECEIVABLE' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Receivables</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Summary Card */}
            <View className="px-4 py-4">
                <View className={`p-6 rounded-2xl border border-outline ${activeTab === 'DEBT' ? 'bg-red-500/10' : 'bg-emerald-500/10'
                    }`}>
                    <Text className="text-onSurfaceVariant text-sm uppercase mb-1">
                        {activeTab === 'DEBT' ? 'Total Outstanding Debt' : 'Total Receivables'}
                    </Text>
                    <Text className={`text-3xl font-bold ${activeTab === 'DEBT' ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                        {formatCurrency(totalAmount)}
                    </Text>
                </View>
            </View>

            {isLoading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : (
                <FlatList
                    data={currentData}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <Text className="text-onSurfaceVariant">No {activeTab.toLowerCase()} found</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center"
                onPress={() => router.push({
                    pathname: '/add-account',
                    params: { type: activeTab === 'DEBT' ? 'LIABILITY' : 'ASSET' } // Hint for default type
                })}
            >
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>
        </View>
    );
}
