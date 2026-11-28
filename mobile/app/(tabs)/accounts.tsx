import { View, Text, SectionList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGetBankAccounts } from '../../src/hooks/useQueries';
import { Account } from '../../src/hooks/useQueries';

export default function AccountsScreen() {
    const router = useRouter();
    // Use useGetBankAccounts directly to match web app logic
    const { data: accounts, isLoading, refetch } = useGetBankAccounts();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    const sections = useMemo(() => {
        if (!accounts) return [];

        // Group by subType
        const groups: Record<string, Account[]> = {};
        accounts.forEach(acc => {
            const subType = acc.subType ? acc.subType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other';
            if (!groups[subType]) groups[subType] = [];
            groups[subType].push(acc);
        });

        // Convert to SectionList format
        return Object.keys(groups).sort().map(category => ({
            title: category,
            data: groups[category],
            total: groups[category].reduce((sum, acc) => sum + Number(acc.balance), 0)
        }));

    }, [accounts]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const totalLiquidity = sections.reduce((sum, section) => sum + section.total, 0);

    if (isLoading) {
        return (
            <View className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View className="pt-14 pb-4 px-4 bg-background border-b border-outline">
                <Text className="text-3xl font-bold text-onSurface mb-1">Accounts</Text>
                <Text className="text-onSurfaceVariant mb-4">Manage your liquidity</Text>

                {/* Total Liquidity Card */}
                <View className="bg-primary/10 border border-primary/25 p-4 rounded-2xl">
                    <Text className="text-onSurfaceVariant text-xs uppercase mb-1">Total Liquidity</Text>
                    <Text className="text-3xl font-bold text-onSurface">{formatCurrency(totalLiquidity)}</Text>
                </View>
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        className="flex-row justify-between items-center p-4 bg-surface border border-outline mx-4 mb-3 rounded-2xl active:bg-surfaceVariant"
                        onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: item.id } })}
                        activeOpacity={0.7}
                    >
                        <View className="flex-row items-center gap-3 flex-1 mr-4">
                            <View className={`w-12 h-12 rounded-full items-center justify-center flex-shrink-0 ${item.type === 'ASSET' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                                }`}>
                                <Ionicons
                                    name={item.type === 'ASSET' ? 'wallet' : 'card'}
                                    size={20}
                                    color={item.type === 'ASSET' ? '#10b981' : '#ef4444'}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-onSurface font-semibold text-base" numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                                <Text className="text-onSurfaceVariant text-xs capitalize font-medium">{item.subType || item.type}</Text>
                            </View>
                        </View>
                        <View className="items-end flex-shrink-0">
                            <Text className={`font-bold text-lg ${item.type === 'LIABILITY' ? 'text-error' : 'text-success'
                                }`}>
                                {formatCurrency(Number(item.balance))}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
                renderSectionHeader={({ section: { title, total } }) => (
                    <View className="flex-row justify-between items-center px-6 py-2 bg-background/95 backdrop-blur-xl mt-2 border-b border-outline">
                        <Text className="text-onSurfaceVariant font-bold uppercase text-xs tracking-widest">{title}</Text>
                        <Text className={`font-bold text-xs ${total < 0 ? 'text-error' : 'text-success'}`}>
                            {formatCurrency(total)}
                        </Text>
                    </View>
                )}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <Text className="text-onSurfaceVariant">No bank accounts found</Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 100 }}
                stickySectionHeadersEnabled={true}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
                }
            />

            <TouchableOpacity
                className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center"
                onPress={() => router.push('/add-account')}
            >
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>
        </View>
    );
}
