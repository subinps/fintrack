import { View, Text, ScrollView, RefreshControl, Dimensions, TouchableOpacity, Modal, Platform } from 'react-native';
import { useGetAccounts, useGetNetWorthHistory, useGetNotifications } from '../../src/hooks/useQueries';
import { useCachedMarketData } from '../../src/hooks/useMarketData';
import { useState, useMemo } from 'react';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import NetWorthAreaChart from '../../src/components/NetWorthAreaChart';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { usePalette } from '../../src/lib/palette';
import Reveal from '../../src/components/Reveal';

export default function OverviewScreen() {
    const router = useRouter();
    const { data: accounts, isLoading, refetch } = useGetAccounts();
    const { data: notifications } = useGetNotifications();
    const unread = notifications?.unread ?? 0;
    const { data: netWorthHistory, refetch: refetchHistory } = useGetNetWorthHistory();
    const { getPrice } = useCachedMarketData();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const palette = usePalette();
    const [refreshing, setRefreshing] = useState(false);
    const screenWidth = Dimensions.get('window').width;

    const [showNetWorthDetails, setShowNetWorthDetails] = useState(false);
    const [showAssetDetails, setShowAssetDetails] = useState(false);

    const calculateMarketValue = (account: any) => {
        if (['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'].includes(account.subType) && account.units) {
            if (account.symbol) {
                const price = getPrice(account.symbol);
                if (price) return price * account.units * 100;
            }
            if (account.lastMarketPrice) {
                return Number(account.lastMarketPrice) * account.units * 100;
            }
        }
        return Number(account.balance);
    };

    const assetAccounts = accounts?.filter(a => a.type === 'ASSET') || [];
    const liabilityAccounts = accounts?.filter(a => a.type === 'LIABILITY') || [];

    // Totals
    const totalAssetsBook = assetAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const totalAssetsMarket = assetAccounts.reduce((sum, acc) => sum + calculateMarketValue(acc), 0);
    const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + Math.abs(Number(acc.balance)), 0);

    const netWorthBook = totalAssetsBook - totalLiabilities;
    const netWorthMarket = totalAssetsMarket - totalLiabilities;

    // Categorize Assets
    const cashAccounts = assetAccounts.filter(a => ['cash', 'wallet', 'savings', 'current'].includes(a.subType?.toLowerCase() || ''));
    const investmentAccounts = assetAccounts.filter(a => !['cash', 'wallet', 'savings', 'current'].includes(a.subType?.toLowerCase() || ''));

    const totalCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const totalInvestmentsBook = investmentAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const totalInvestmentsMarket = investmentAccounts.reduce((sum, acc) => sum + calculateMarketValue(acc), 0);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const chartData = useMemo(() => {
        if (!netWorthHistory || netWorthHistory.length === 0) return [];
        const sorted = [...netWorthHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return sorted.map(item => ({
            value: item.netWorth / 100,
            label: new Date(item.date).getDate().toString(),
            labelTextStyle: { color: palette.onSurfaceVariant, fontSize: 10 },
        }));
    }, [netWorthHistory]);

    const pieData = useMemo(() => {
        const allocation: Record<string, number> = {};
        assetAccounts.forEach(acc => {
            const type = acc.subType ? acc.subType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other';
            const value = calculateMarketValue(acc);
            if (value > 0) {
                allocation[type] = (allocation[type] || 0) + value;
            }
        });

        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
        const data = Object.entries(allocation)
            .map(([name, value], index) => ({
                value: value / 100,
                text: name,
                color: COLORS[index % COLORS.length],
            }))
            .sort((a, b) => b.value - a.value);

        return data;
    }, [assetAccounts]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetch(), refetchHistory()]);
        setRefreshing(false);
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-background justify-center items-center">
                <Text className="text-onSurface text-lg">Loading...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-background"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        >
            <Reveal>
            <View className="px-4 pt-12 pb-6">
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Text className="text-onSurfaceVariant text-[11px] font-semibold uppercase tracking-[2px]">FinTrack</Text>
                        <Text className="text-3xl font-bold text-onSurface tracking-tight">Overview</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push('/notifications')}
                        className="w-11 h-11 rounded-full bg-surface border border-outline items-center justify-center"
                        accessibilityLabel={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
                    >
                        <Ionicons name="notifications-outline" size={20} color={palette.onSurface} />
                        {unread > 0 && (
                            <View className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error items-center justify-center border-2 border-background">
                                <Text className="text-white text-[9px] font-bold">{unread > 9 ? '9+' : unread}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* 4 Cards Grid */}
                <View className="flex-row flex-wrap gap-3 mb-6">
                    {/* Net Worth */}
                    <TouchableOpacity
                        className="w-[48%] bg-surface/50 rounded-3xl p-4 border-l-4 border-l-primary border-t border-r border-b border-outline"
                        onPress={() => setShowNetWorthDetails(true)}
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-onSurfaceVariant text-xs font-medium uppercase">Net Worth</Text>
                            <Ionicons name="wallet-outline" size={16} color={palette.primary} />
                        </View>
                        <Text className="text-onSurface text-lg font-bold mb-1" numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(netWorthMarket)}
                        </Text>
                        <Text className="text-onSurfaceVariant text-[10px]">
                            Book: {formatCurrency(netWorthBook)}
                        </Text>
                    </TouchableOpacity>

                    {/* Total Assets */}
                    <TouchableOpacity
                        className="w-[48%] bg-surface/50 rounded-3xl p-4 border-l-4 border-l-secondary border-t border-r border-b border-outline"
                        onPress={() => setShowAssetDetails(true)}
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-onSurfaceVariant text-xs font-medium uppercase">Total Assets</Text>
                            <Ionicons name="trending-up-outline" size={16} color={palette.success} />
                        </View>
                        <Text className="text-success text-lg font-bold mb-1" numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(totalAssetsMarket)}
                        </Text>
                        <Text className="text-onSurfaceVariant text-[10px]">
                            Cash: {formatCurrency(totalCash)}
                        </Text>
                    </TouchableOpacity>

                    {/* Total Liabilities */}
                    <TouchableOpacity
                        className="w-[48%] bg-surface/50 rounded-3xl p-4 border-l-4 border-l-error border-t border-r border-b border-outline"
                        onPress={() => router.push({ pathname: '/chart-of-accounts', params: { initialSearch: 'LIABILITY' } })}
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-onSurfaceVariant text-xs font-medium uppercase">Liabilities</Text>
                            <Ionicons name="arrow-down-circle-outline" size={16} color={palette.error} />
                        </View>
                        <Text className="text-error text-lg font-bold mb-1" numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(totalLiabilities)}
                        </Text>
                        <Text className="text-onSurfaceVariant text-[10px]">Debt & Payables</Text>
                    </TouchableOpacity>

                    {/* Liquid Cash */}
                    <TouchableOpacity
                        className="w-[48%] bg-surface/50 rounded-3xl p-4 border-l-4 border-l-blue-400 border-t border-r border-b border-outline"
                        onPress={() => router.push({ pathname: '/chart-of-accounts', params: { initialSearch: 'ASSET' } })}
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-onSurfaceVariant text-xs font-medium uppercase">Liquid Cash</Text>
                            <Ionicons name="cash-outline" size={16} color={palette.info} />
                        </View>
                        <Text className="text-info text-lg font-bold mb-1" numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(totalCash)}
                        </Text>
                        <Text className="text-onSurfaceVariant text-[10px]">Available to spend</Text>
                    </TouchableOpacity>
                </View>

                {/* Asset Allocation Pie Chart */}
                {pieData.length > 0 ? (
                    <View className="bg-surface/50 backdrop-blur-xl rounded-3xl p-6 border border-outline mb-6">
                        <Text className="text-onSurface text-lg font-semibold mb-4">Asset Allocation</Text>
                        <View className="items-center">
                            <PieChart
                                data={pieData}
                                donut
                                textColor={palette.onSurfaceVariant}
                                radius={100}
                                innerRadius={60}
                                textSize={10}
                                focusOnPress
                                showValuesAsLabels={false}
                            />
                        </View>
                        <View className="flex-row flex-wrap justify-center gap-4 mt-6">
                            {pieData.map((item, index) => (
                                <View key={index} className="flex-row items-center gap-2">
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                                    <Text className="text-onSurfaceVariant text-xs">{item.text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View className="bg-surface/50 backdrop-blur-xl rounded-3xl p-6 border border-outline mb-6">
                        <Text className="text-onSurface text-lg font-semibold mb-2">Asset Allocation</Text>
                        <Text className="text-onSurfaceVariant">No assets to display.</Text>
                    </View>
                )}

                {/* Net Worth Chart */}
                {chartData.length > 1 ? (
                    <View className="bg-surface/50 backdrop-blur-xl rounded-3xl p-4 border border-outline mb-4 overflow-hidden">
                        <View className="flex-row justify-between items-center mb-4 ml-2 mr-2">
                            <Text className="text-onSurface text-lg font-semibold">Net Worth Growth</Text>
                            <TouchableOpacity onPress={() => router.push('/analytics')}>
                                <Text className="text-primary text-sm font-bold">View Analytics</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ marginLeft: -20 }}>
                            {Platform.OS === 'web' ? (
                                <NetWorthAreaChart
                                    data={chartData}
                                    width={screenWidth - 40}
                                    height={212}
                                    isDark={isDark}
                                />
                            ) : (
                            <LineChart
                                data={chartData}
                                areaChart
                                curved
                                color={palette.primary}
                                startFillColor={isDark ? 'rgba(88,181,150,0.30)' : 'rgba(31,110,90,0.18)'}
                                endFillColor="rgba(79,70,229,0.01)"
                                startOpacity={0.9}
                                endOpacity={0.2}
                                initialSpacing={20}
                                noOfSections={4}
                                yAxisTextStyle={{ color: palette.onSurfaceVariant, fontSize: 10 }}
                                xAxisLabelTextStyle={{ color: palette.onSurfaceVariant, fontSize: 10 }}
                                rulesColor={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'}
                                rulesType="solid"
                                hideRules={false}
                                yAxisColor="transparent"
                                xAxisColor="transparent"
                                thickness={3}
                                hideDataPoints={false}
                                dataPointsColor={palette.primary}
                                dataPointsRadius={4}
                                width={screenWidth - 80}
                                height={200}
                                pointerConfig={{
                                    pointerStripHeight: 160,
                                    pointerStripColor: palette.onSurfaceVariant,
                                    pointerStripWidth: 2,
                                    pointerColor: palette.primary,
                                    radius: 6,
                                    pointerLabelWidth: 100,
                                    pointerLabelHeight: 90,
                                    activatePointersOnLongPress: true,
                                    autoAdjustPointerLabelPosition: false,
                                    pointerLabelComponent: (items: any) => {
                                        return (
                                            <View
                                                style={{
                                                    height: 90,
                                                    width: 100,
                                                    justifyContent: 'center',
                                                    marginTop: -30,
                                                    marginLeft: -40,
                                                }}>
                                                <Text style={{ color: 'black', fontSize: 14, marginBottom: 6, textAlign: 'center' }}>
                                                    {items[0].date}
                                                </Text>
                                                <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'white' }}>
                                                    <Text style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                        {formatCurrency(items[0].value * 100)}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    },
                                }}
                            />
                            )}
                        </View>
                    </View>
                ) : (
                    <View className="bg-surface/50 backdrop-blur-xl rounded-3xl p-6 border border-outline mb-4">
                        <Text className="text-onSurface text-lg font-semibold mb-2">Net Worth Growth</Text>
                        <Text className="text-onSurfaceVariant">Not enough data points for chart yet.</Text>
                    </View>
                )}
            </View>

            {/* Net Worth Details Modal */}
            <Modal
                visible={showNetWorthDetails}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowNetWorthDetails(false)}
            >
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-surface rounded-t-3xl p-6 border-t border-outline">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-onSurface text-xl font-bold">Net Worth Breakdown</Text>
                            <TouchableOpacity onPress={() => setShowNetWorthDetails(false)}>
                                <Ionicons name="close" size={24} color={palette.onSurfaceVariant} />
                            </TouchableOpacity>
                        </View>
                        <View className="space-y-4">
                            <View className="flex-row justify-between items-center p-4 bg-background/50 rounded-xl border border-outline">
                                <View>
                                    <Text className="text-onSurfaceVariant text-sm">Total Assets</Text>
                                    <Text className="text-success text-xl font-bold">{formatCurrency(totalAssetsMarket)}</Text>
                                </View>
                                <TouchableOpacity
                                    className="bg-surfaceVariant p-2 rounded-full"
                                    onPress={() => { setShowNetWorthDetails(false); setShowAssetDetails(true); }}
                                >
                                    <Ionicons name="arrow-forward" size={20} color={palette.onSurfaceVariant} />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row justify-between items-center p-4 bg-background/50 rounded-xl border border-outline">
                                <View>
                                    <Text className="text-onSurfaceVariant text-sm">Total Liabilities</Text>
                                    <Text className="text-error text-xl font-bold">{formatCurrency(totalLiabilities)}</Text>
                                </View>
                                <TouchableOpacity
                                    className="bg-surfaceVariant p-2 rounded-full"
                                    onPress={() => { setShowNetWorthDetails(false); router.push({ pathname: '/chart-of-accounts', params: { initialSearch: 'LIABILITY' } }); }}
                                >
                                    <Ionicons name="arrow-forward" size={20} color={palette.onSurfaceVariant} />
                                </TouchableOpacity>
                            </View>
                            <View className="pt-4 border-t border-outline flex-row justify-between items-center">
                                <Text className="text-onSurface font-bold text-lg">Net Worth</Text>
                                <Text className="text-primary-400 font-bold text-xl">{formatCurrency(netWorthMarket)}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Asset Details Modal */}
            <Modal
                visible={showAssetDetails}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowAssetDetails(false)}
            >
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-surface rounded-t-3xl p-6 border-t border-outline">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-onSurface text-xl font-bold">Assets Breakdown</Text>
                            <TouchableOpacity onPress={() => setShowAssetDetails(false)}>
                                <Ionicons name="close" size={24} color={palette.onSurfaceVariant} />
                            </TouchableOpacity>
                        </View>
                        <View className="space-y-4">
                            <View className="flex-row justify-between items-center p-4 bg-background/50 rounded-xl border border-outline">
                                <View>
                                    <Text className="text-onSurfaceVariant text-sm">Bank & Cash</Text>
                                    <Text className="text-info text-xl font-bold">{formatCurrency(totalCash)}</Text>
                                    <Text className="text-onSurfaceVariant text-xs">Liquid funds</Text>
                                </View>
                                <TouchableOpacity
                                    className="bg-surfaceVariant p-2 rounded-full"
                                    onPress={() => { setShowAssetDetails(false); router.push({ pathname: '/chart-of-accounts', params: { initialSearch: 'ASSET' } }); }}
                                >
                                    <Ionicons name="arrow-forward" size={20} color={palette.onSurfaceVariant} />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row justify-between items-center p-4 bg-background/50 rounded-xl border border-outline">
                                <View>
                                    <Text className="text-onSurfaceVariant text-sm">Investments</Text>
                                    <Text className="text-success text-xl font-bold">{formatCurrency(totalInvestmentsMarket)}</Text>
                                    <Text className="text-onSurfaceVariant text-xs">Stocks, Mutual Funds</Text>
                                </View>
                                <TouchableOpacity
                                    className="bg-surfaceVariant p-2 rounded-full"
                                    onPress={() => { setShowAssetDetails(false); router.push('/investments'); }}
                                >
                                    <Ionicons name="arrow-forward" size={20} color={palette.onSurfaceVariant} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
            </Reveal>
        </ScrollView>
    );
}
