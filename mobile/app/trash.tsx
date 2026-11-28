import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import * as Haptics from '../src/lib/haptics';
import { useGetTrash, useRestoreTransaction, useBulkTransactionAction, Transaction } from '../src/hooks/useQueries';
import { useAlert } from '../src/context/AlertContext';
import { formatCurrency, formatDateLabel, transactionTotal } from '../src/lib/format';

export default function TrashScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { showAlert } = useAlert();

    const { data: txns, isLoading, refetch, isRefetching } = useGetTrash();
    const restore = useRestoreTransaction();
    const bulk = useBulkTransactionAction();

    const [selected, setSelected] = useState<number[]>([]);
    const selecting = selected.length > 0;

    const toggle = useCallback((id: number) => {
        Haptics.selectionAsync();
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }, []);

    const handleRestore = useCallback(
        async (id: number) => {
            try {
                await restore.mutateAsync(id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSelected((prev) => prev.filter((x) => x !== id));
            } catch (error) {
                showAlert('Error', 'Could not restore this transaction.');
            }
        },
        [restore, showAlert]
    );

    const handleRestoreSelected = useCallback(async () => {
        try {
            await bulk.mutateAsync({ ids: selected, action: 'restore' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showAlert('Restored', `${selected.length} transaction${selected.length > 1 ? 's' : ''} back in your ledger.`);
            setSelected([]);
        } catch (error) {
            showAlert('Error', 'Could not restore the selected transactions.');
        }
    }, [bulk, selected, showAlert]);

    const total = useMemo(() => txns?.length ?? 0, [txns]);

    const renderItem = ({ item, index }: { item: Transaction; index: number }) => {
        const isPicked = selected.includes(item.id);
        const amount = transactionTotal(item);
        return (
            <Animated.View entering={FadeInDown.delay(index * 40).springify().damping(18)} layout={LinearTransition.springify()}>
                <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => (selecting ? toggle(item.id) : null)}
                    onLongPress={() => toggle(item.id)}
                    className={`mx-4 mb-3 rounded-3xl border p-4 ${isPicked ? 'border-primary-600 bg-primary-600/10' : 'border-outline bg-surface'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-11 h-11 rounded-2xl items-center justify-center ${isPicked ? 'bg-primary-600' : 'bg-error/10'}`}>
                            <Ionicons name={isPicked ? 'checkmark' : 'trash-outline'} size={19} color={isPicked ? '#fff' : isDark ? '#f87171' : '#d6293e'} />
                        </View>
                        <View className="flex-1 ml-3 mr-2">
                            <Text className="text-onSurface font-semibold" numberOfLines={1}>
                                {item.description}
                            </Text>
                            <Text className="text-onSurfaceVariant text-xs mt-1" numberOfLines={1}>
                                Voided • {formatDateLabel(item.date)} • {item.splits.map((s) => s.account?.name).filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-onSurface font-bold tabular-nums">{formatCurrency(amount)}</Text>
                            <TouchableOpacity
                                onPress={() => handleRestore(item.id)}
                                className="mt-2 px-3 py-1.5 rounded-full bg-success/15"
                            >
                                <Text className="text-success text-xs font-bold">Restore</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-background">
            <View className="pt-16 pb-3 px-4 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-surface border border-outline items-center justify-center">
                        <Ionicons name="arrow-back" size={20} color={isDark ? '#e9edf8' : '#141928'} />
                    </TouchableOpacity>
                    <View className="ml-3">
                        <Text className="text-2xl font-bold text-onSurface tracking-tight">Trash</Text>
                        <Text className="text-onSurfaceVariant text-xs mt-0.5">
                            {total === 0 ? 'Empty' : `${total} voided transaction${total > 1 ? 's' : ''}`}
                        </Text>
                    </View>
                </View>
                {selecting && (
                    <TouchableOpacity onPress={() => setSelected([])}>
                        <Text className="text-primary-500 font-semibold">Clear</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={isDark ? '#8b8dff' : '#4f46e5'} />
                </View>
            ) : (
                <FlatList
                    data={txns ?? []}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: selecting ? 140 : 40 }}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={isDark ? '#8b8dff' : '#4f46e5'} />
                    }
                    ListEmptyComponent={
                        <View className="items-center px-10 py-24">
                            <View className="w-20 h-20 rounded-full bg-surface border border-outline items-center justify-center mb-5">
                                <Ionicons name="sparkles-outline" size={30} color={isDark ? '#7d8bff' : '#4f46e5'} />
                            </View>
                            <Text className="text-onSurface font-bold text-lg">Nothing in the trash</Text>
                            <Text className="text-onSurfaceVariant text-sm text-center mt-2 leading-5">
                                Deleted transactions pause here first. Tap one to restore it, so a mistake costs a tap, not a balance.
                            </Text>
                        </View>
                    }
                />
            )}

            {selecting && (
                <Animated.View entering={FadeInDown.springify()} className="absolute bottom-8 left-4 right-4">
                    <TouchableOpacity
                        onPress={handleRestoreSelected}
                        activeOpacity={0.85}
                        className="bg-primary-600 rounded-3xl py-4 flex-row items-center justify-center"
                    >
                        <Ionicons name="refresh" size={18} color="#fff" />
                        <Text className="text-white font-bold ml-2">Restore {selected.length}</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
}
