import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useGetTransactions } from '../src/hooks/useQueries';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';

export default function AnalyticsScreen() {
    const router = useRouter();
    const { data: transactions } = useGetTransactions();
    const screenWidth = Dimensions.get('window').width;
    const [selectedPeriod, setSelectedPeriod] = useState<'ALL' | 'MONTH'>('ALL');
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const chartData = useMemo(() => {
        if (!transactions) return { barData: [], pieData: [] };

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryTotals: { [key: string]: number } = {};

        transactions.forEach(tx => {
            tx.splits.forEach(split => {
                const amount = Number(split.amount); // BigInt string to number
                const type = split.account?.type;
                const categoryName = split.account?.name || 'Uncategorized';

                if (type === 'INCOME') {
                    if (amount < 0) totalIncome += Math.abs(amount);
                } else if (type === 'EXPENSE') {
                    if (amount > 0) {
                        totalExpense += amount;
                        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + amount;
                    }
                }
            });
        });

        const barData = [
            { value: totalIncome / 100, label: 'Income', frontColor: '#10b981' },
            { value: totalExpense / 100, label: 'Expense', frontColor: '#ef4444' },
        ];

        const pieData = Object.entries(categoryTotals)
            .map(([name, value], index) => ({
                value: value / 100,
                text: name,
                color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5],
                legendFontColor: isDark ? '#fff' : '#000',
                legendFontSize: 12,
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5 categories

        return { barData, pieData };
    }, [transactions, isDark]);

    return (
        <View className="flex-1 bg-background">
            <View className="pt-16 pb-4 px-6 bg-background z-10 flex-row items-center gap-4">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? "white" : "black"} />
                </TouchableOpacity>
                <Text className="text-3xl font-bold text-onSurface">Analytics</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Income vs Expense Bar Chart */}
                <View className="bg-surface rounded-3xl p-6 border border-outline mb-6">
                    <Text className="text-onSurface text-lg font-bold mb-6">Income vs Expense</Text>
                    {chartData.barData.some(d => d.value > 0) ? (
                        <BarChart
                            data={chartData.barData}
                            barWidth={40}
                            noOfSections={4}
                            barBorderRadius={4}
                            frontColor="lightgray"
                            yAxisThickness={0}
                            xAxisThickness={0}
                            yAxisTextStyle={{ color: 'gray' }}
                            xAxisLabelTextStyle={{ color: 'gray' }}
                            width={screenWidth - 100}
                            height={200}
                            isAnimated
                        />
                    ) : (
                        <Text className="text-onSurfaceVariant text-center py-8">No transaction data available.</Text>
                    )}
                </View>

                {/* Expense Breakdown Pie Chart */}
                <View className="bg-surface rounded-3xl p-6 border border-outline mb-6">
                    <Text className="text-onSurface text-lg font-bold mb-6">Top Expenses</Text>
                    {chartData.pieData.length > 0 ? (
                        <>
                            <View className="items-center">
                                <PieChart
                                    data={chartData.pieData}
                                    donut
                                    showGradient
                                    sectionAutoFocus
                                    radius={90}
                                    innerRadius={60}
                                    innerCircleColor={isDark ? '#0f172a' : '#ffffff'} // Match card bg (Slate 900 vs White)
                                    centerLabelComponent={() => {
                                        return (
                                            <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 22, color: isDark ? 'white' : 'black', fontWeight: 'bold' }}>
                                                    {chartData.pieData.length}
                                                </Text>
                                                <Text style={{ fontSize: 14, color: isDark ? 'white' : 'black' }}>Cats</Text>
                                            </View>
                                        );
                                    }}
                                />
                            </View>
                            <View className="mt-6 space-y-3">
                                {chartData.pieData.map((item, index) => (
                                    <View key={index} className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-2">
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                                            <Text className="text-onSurfaceVariant">{item.text}</Text>
                                        </View>
                                        <Text className="text-onSurface font-bold">₹{item.value.toFixed(0)}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : (
                        <Text className="text-onSurfaceVariant text-center py-8">No expense data available.</Text>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
