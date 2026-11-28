import { View, Text, ScrollView, RefreshControl, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useGetInvestments } from '../../src/hooks/useQueries';
import { useRefreshAllPrices, useCachedMarketData } from '../../src/hooks/useMarketData';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from '../../src/lib/haptics';

export default function InvestmentsScreen() {
    const router = useRouter();
    const { data: investments, isLoading, refetch } = useGetInvestments();
    const refreshAllPrices = useRefreshAllPrices();
    const { getPrice } = useCachedMarketData();
    const [refreshing, setRefreshing] = useState(false);
    const [refreshingItems, setRefreshingItems] = useState<Record<number, boolean>>({});
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const onRefresh = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        try {
            await refetch();
            if (investments && investments.length > 0) {
                const symbolsToRefresh = investments
                    .filter(inv => inv.symbol)
                    .map(inv => ({ symbol: inv.symbol!, accountId: inv.id }));

                if (symbolsToRefresh.length > 0) {
                    await refreshAllPrices.mutateAsync(symbolsToRefresh);
                }
            }
        } catch (error) {
            console.error("Refresh failed", error);
        } finally {
            setRefreshing(false);
        }
    }, [investments, refetch, refreshAllPrices]);

    const onRefreshItem = async (item: any) => {
        if (!item.symbol) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshingItems(prev => ({ ...prev, [item.id]: true }));
        try {
            await refreshAllPrices.mutateAsync([{ symbol: item.symbol, accountId: item.id }]);
        } catch (error) {
            console.error("Failed to refresh item", error);
        } finally {
            setRefreshingItems(prev => ({ ...prev, [item.id]: false }));
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const calculateCurrentValue = (investment: any) => {
        const livePrice = investment.symbol ? getPrice(investment.symbol) : null;
        if (livePrice && investment.units) {
            return livePrice * investment.units * 100;
        }
        if (investment.lastMarketPrice && investment.units) {
            return Number(investment.lastMarketPrice) * investment.units * 100;
        }
        return Number(investment.balance);
    };

    const totalValue = useMemo(() => {
        return investments?.reduce((sum, inv) => sum + calculateCurrentValue(inv), 0) || 0;
    }, [investments, getPrice]);

    const groupedInvestments = useMemo(() => {
        if (!investments) return {};
        const groups: { [key: string]: any[] } = {};
        investments.forEach(inv => {
            const type = inv.subType || 'other-investment';
            if (!groups[type]) groups[type] = [];
            groups[type].push(inv);
        });
        return groups;
    }, [investments]);

    const renderInvestmentCard = ({ item }: { item: any }) => {
        const currentValue = calculateCurrentValue(item);
        const invested = Number(item.balance);
        const change = currentValue - invested;
        const changePercent = invested > 0 ? (change / invested) * 100 : 0;
        const isPositive = change >= 0;
        const isRefreshingItem = refreshingItems[item.id];

        return (
            <TouchableOpacity
                key={item.id}
                className="mb-3 rounded-2xl overflow-hidden border border-outline bg-surface active:bg-surfaceVariant"
                onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: item.id } })}
                activeOpacity={0.7}
            >
                <View className="p-4">
                    <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 mr-2">
                            <Text className="text-onSurface font-semibold text-base" numberOfLines={1}>{item.name}</Text>
                            <Text className="text-onSurfaceVariant text-xs font-medium">{item.symbol || 'No Symbol'}</Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-onSurface font-bold text-lg">{formatCurrency(currentValue)}</Text>
                            <Text className={`text-xs font-medium ${isPositive ? 'text-success' : 'text-error'}`}>
                                {isPositive ? '+' : ''}{formatCurrency(change)} ({changePercent.toFixed(1)}%)
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row justify-between mt-2 pt-2 border-t border-outline items-center">
                        <View>
                            <Text className="text-onSurfaceVariant text-[10px] uppercase font-bold tracking-wider">Invested</Text>
                            <Text className="text-onSurfaceVariant text-xs font-medium">{formatCurrency(invested)}</Text>
                        </View>
                        <View>
                            <Text className="text-onSurfaceVariant text-[10px] uppercase font-bold tracking-wider">Units</Text>
                            <Text className="text-onSurfaceVariant text-xs font-medium">{item.units?.toFixed(4) || '0'}</Text>
                        </View>
                        <View>
                            <Text className="text-onSurfaceVariant text-[10px] uppercase font-bold tracking-wider">Live Price</Text>
                            <View className="flex-row items-center gap-1">
                                <Text className="text-primary-400 text-xs font-medium">
                                    {item.symbol && getPrice(item.symbol)
                                        ? formatCurrency(getPrice(item.symbol)! * 100)
                                        : (item.lastMarketPrice ? formatCurrency(Number(item.lastMarketPrice) * 100) : '-')}
                                </Text>
                                {item.symbol && (
                                    <TouchableOpacity
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            onRefreshItem(item);
                                        }}
                                        disabled={isRefreshingItem}
                                        className="p-1"
                                    >
                                        {isRefreshingItem ? (
                                            <ActivityIndicator size={10} color="#60a5fa" />
                                        ) : (
                                            <Ionicons name="refresh" size={12} color="#60a5fa" />
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderCategoryCard = (type: string, items: any[]) => {
        const typeTotal = items.reduce((sum, inv) => sum + calculateCurrentValue(inv), 0);

        return (
            <TouchableOpacity
                key={type}
                onPress={() => setSelectedType(type)}
                className="mb-3 rounded-2xl overflow-hidden border border-outline bg-surface active:bg-surfaceVariant"
                activeOpacity={0.7}
            >
                <View className="p-4 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-full bg-primary-500/10 items-center justify-center">
                            <Ionicons
                                name={type === 'crypto' ? 'logo-bitcoin' : type === 'stock' ? 'trending-up' : 'pie-chart'}
                                size={20}
                                color="#3b82f6"
                            />
                        </View>
                        <View>
                            <Text className="text-onSurface font-semibold text-lg capitalize">{type.replace('-', ' ')}</Text>
                            <Text className="text-onSurfaceVariant text-xs font-medium">{items.length} Investments</Text>
                        </View>
                    </View>
                    <View className="items-end">
                        <Text className="text-onSurface font-bold text-lg">{formatCurrency(typeTotal)}</Text>
                        <Ionicons name="chevron-forward" size={16} color={isDark ? "#94a3b8" : "#6b7280"} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (selectedType) {
        const items = groupedInvestments[selectedType] || [];
        const typeTotal = items.reduce((sum, inv) => sum + calculateCurrentValue(inv), 0);

        return (
            <View className="flex-1 bg-background">
                <View className="pt-12 px-6 pb-4 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4">
                        <TouchableOpacity
                            onPress={() => setSelectedType(null)}
                            className="w-10 h-10 rounded-full bg-surfaceVariant items-center justify-center"
                        >
                            <Ionicons name="arrow-back" size={24} color={isDark ? "#94a3b8" : "#a1a1aa"} />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-onSurface text-2xl font-bold capitalize">{selectedType.replace('-', ' ')}</Text>
                            <Text className="text-primary-400 font-semibold">{formatCurrency(typeTotal)}</Text>
                        </View>
                    </View>
                </View>

                <FlatList
                    data={items}
                    renderItem={renderInvestmentCard}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
                    }
                />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            <View className="absolute top-12 right-6 z-10">
                <TouchableOpacity
                    onPress={onRefresh}
                    className="w-10 h-10 rounded-full bg-surfaceVariant items-center justify-center backdrop-blur-md"
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Ionicons name="refresh" size={20} color={isDark ? "#94a3b8" : "#a1a1aa"} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: 16, paddingTop: 60 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
                }
            >
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-onSurface mb-1">Portfolio</Text>
                    <Text className="text-onSurfaceVariant">Track your wealth growth</Text>
                </View>

                {/* Total Value Card */}
                <LinearGradient
                    colors={['#3b82f6', '#1e6482', '#1d4ed8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="rounded-3xl p-8 mb-8 border border-white/10 overflow-hidden"
                >
                    <Text className="text-blue-100 font-medium mb-1 text-lg opacity-80">Total Portfolio Value</Text>
                    <Text className="text-5xl font-bold text-white mt-1 tracking-tight">{formatCurrency(totalValue)}</Text>

                </LinearGradient>

                <Text className="text-onSurface font-bold text-lg mb-4">Categories</Text>

                {Object.keys(groupedInvestments).length > 0 ? (
                    Object.entries(groupedInvestments).map(([type, items]) => renderCategoryCard(type, items))
                ) : (
                    <View className="items-center py-10">
                        <Text className="text-onSurfaceVariant">No investments found.</Text>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity
                className="absolute bottom-6 right-6 w-16 h-16 bg-primary-600 rounded-full items-center justify-center border border-outline"
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/add-investment');
                }}
            >
                <Ionicons name="add" size={32} color="white" />
            </TouchableOpacity>
        </View>
    );
}
