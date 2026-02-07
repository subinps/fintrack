import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useGetAccountBalanceHistory, useGetAccounts } from '../../src/hooks/useQueries';
import { LineChart } from 'react-native-gifted-charts';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

export default function AccountHistoryScreen() {
    const { id } = useLocalSearchParams();
    const accountId = Number(id);
    const router = useRouter();
    const { data: accounts } = useGetAccounts();
    const account = accounts?.find(a => a.id === accountId);
    const [period, setPeriod] = useState<'day' | 'month'>('day');
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const { data: history, isLoading } = useGetAccountBalanceHistory(accountId, period);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    const chartData = history?.map(point => ({
        value: point.balance / 100,
        label: new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        dataPointText: formatCurrency(point.balance),
    })) || [];

    if (isLoading || !account) {
        return (
            <View className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{
                title: 'Balance History',
                headerStyle: { backgroundColor: isDark ? '#020617' : '#fff' },
                headerTintColor: isDark ? '#fff' : '#000',
                headerTitleStyle: { fontWeight: 'bold' },
            }} />

            <View className="p-4">
                <Text className="text-onSurfaceVariant text-sm uppercase mb-1">{account.name}</Text>
                <Text className="text-3xl font-bold text-onSurface mb-6">
                    {formatCurrency(Number(account.balance))}
                </Text>

                {/* Period Selector */}
                <View className="flex-row bg-surface p-1 rounded-xl border border-outline mb-6">
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${period === 'day' ? 'bg-surfaceVariant border border-outline' : ''}`}
                        onPress={() => setPeriod('day')}
                    >
                        <Text className={`font-bold ${period === 'day' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Daily</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-lg items-center ${period === 'month' ? 'bg-surfaceVariant border border-outline' : ''}`}
                        onPress={() => setPeriod('month')}
                    >
                        <Text className={`font-bold ${period === 'month' ? 'text-onSurface' : 'text-onSurfaceVariant'}`}>Monthly</Text>
                    </TouchableOpacity>
                </View>

                {/* Chart */}
                <View className="bg-surface p-4 rounded-2xl border border-outline items-center">
                    {chartData.length > 0 ? (
                        <LineChart
                            data={chartData}
                            color="#10b981"
                            thickness={2}
                            startFillColor="rgba(16, 185, 129, 0.3)"
                            endFillColor="rgba(16, 185, 129, 0.01)"
                            startOpacity={0.9}
                            endOpacity={0.2}
                            initialSpacing={20}
                            noOfSections={4}
                            yAxisTextStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                            xAxisLabelTextStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                            rulesColor="rgba(255,255,255,0.1)"
                            rulesType="solid"
                            yAxisColor="transparent"
                            xAxisColor="transparent"
                            width={Dimensions.get('window').width - 80}
                            height={250}
                            curved
                            isAnimated
                            hideDataPoints={false}
                            dataPointsColor="#10b981"
                            dataPointsRadius={4}
                            pointerConfig={{
                                pointerStripHeight: 160,
                                pointerStripColor: 'lightgray',
                                pointerStripWidth: 2,
                                pointerColor: 'lightgray',
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
                                            <Text style={{ color: 'white', fontSize: 14, marginBottom: 6, textAlign: 'center' }}>
                                                {items[0].date}
                                            </Text>
                                            <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'white' }}>
                                                <Text style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                    {items[0].value}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                },
                            }}
                        />
                    ) : (
                        <View className="h-64 justify-center items-center">
                            <Text className="text-onSurfaceVariant">No history data available</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
