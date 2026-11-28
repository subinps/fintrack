import { memo, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '../src/lib/haptics';
import { useGetNotifications, useMarkNotificationsRead, AppNotification } from '../src/hooks/useQueries';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    NETWORTH: 'trending-up',
    PRICE: 'pulse',
    BUDGET: 'pie-chart',
    TRANSACTION: 'swap-horizontal',
    ACCOUNT: 'wallet',
};

function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const Row = memo(function Row({ item, index, markRead }: { item: AppNotification; index: number; markRead: () => void }) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const unread = !item.readAt;
    return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(18)}>
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                    Haptics.selectionAsync();
                    if (unread) markRead();
                }}
                className={`mx-4 mb-2.5 rounded-3xl border p-4 flex-row ${unread ? 'border-primary-600/40 bg-surface' : 'border-outline bg-surface/60'}`}
            >
                <View className={`w-10 h-10 rounded-2xl items-center justify-center ${unread ? 'bg-primary-600' : 'bg-surfaceVariant'}`}>
                    <Ionicons
                        name={ICONS[item.type] ?? 'notifications-outline'}
                        size={18}
                        color={unread ? '#fff' : isDark ? '#a0a8be' : '#545b6e'}
                    />
                </View>
                <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                        <Text className={`flex-1 text-sm ${unread ? 'font-bold text-onSurface' : 'font-semibold text-onSurfaceVariant'}`} numberOfLines={1}>
                            {item.title}
                        </Text>
                        <Text className="text-onSurfaceVariant text-[11px] ml-2">{relativeTime(item.createdAt)}</Text>
                    </View>
                    <Text className="text-onSurfaceVariant text-[13px] mt-1 leading-5" numberOfLines={3}>
                        {item.body}
                    </Text>
                </View>
                {unread && <View className="w-2 h-2 rounded-full bg-primary-500 ml-2 mt-2" />}
            </TouchableOpacity>
        </Animated.View>
    );
});

export default function NotificationsScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { data, isLoading, refetch, isRefetching } = useGetNotifications();
    const markRead = useMarkNotificationsRead();

    const items = data?.items ?? [];
    const unread = data?.unread ?? 0;
    const subtitle = useMemo(() => {
        if (unread === 0) return 'All caught up';
        return `${unread} unread`;
    }, [unread]);

    return (
        <View className="flex-1 bg-background">
            <View className="pt-16 pb-3 px-4 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-surface border border-outline items-center justify-center">
                        <Ionicons name="arrow-back" size={20} color={isDark ? '#e9edf8' : '#141928'} />
                    </TouchableOpacity>
                    <View className="ml-3">
                        <Text className="text-2xl font-bold text-onSurface tracking-tight">Activity</Text>
                        <Text className="text-onSurfaceVariant text-xs mt-0.5">{subtitle}</Text>
                    </View>
                </View>
                {unread > 0 && (
                    <TouchableOpacity
                        onPress={() => markRead.mutateAsync().catch(() => undefined)}
                        className="px-3 py-2 rounded-full bg-surface border border-outline"
                    >
                        <Text className="text-primary-500 text-xs font-bold">Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={isDark ? '#8b8dff' : '#4f46e5'} />
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <Row item={item} index={index} markRead={() => markRead.mutateAsync().catch(() => undefined)} />
                    )}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={isDark ? '#8b8dff' : '#4f46e5'} />}
                    ListEmptyComponent={
                        <View className="items-center px-10 py-24">
                            <View className="w-20 h-20 rounded-full bg-surface border border-outline items-center justify-center mb-5">
                                <Ionicons name="notifications-outline" size={30} color={isDark ? '#7d8bff' : '#4f46e5'} />
                            </View>
                            <Text className="text-onSurface font-bold text-lg">Nothing yet</Text>
                            <Text className="text-onSurfaceVariant text-sm text-center mt-2 leading-5">
                                Net worth snapshots, price moves and ledger alerts land here as they happen.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
