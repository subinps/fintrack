import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../../src/lib/palette';
import { Platform, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from '../../src/lib/haptics';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

function TabIcon({ name, color, size, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number; focused: boolean }) {
    const style = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(focused ? 1.12 : 1, { damping: 14, stiffness: 220 }) }],
    }), [focused]);

    return (
        <Animated.View style={style} className="items-center justify-center">
            <Ionicons name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)} size={size} color={color} />
        </Animated.View>
    );
}

function TabButton({ children, onPress, accessibilityState }: BottomTabBarButtonProps) {
    const focused = accessibilityState?.selected;
    return (
        <Pressable
            onPress={(event) => {
                Haptics.selectionAsync();
                onPress?.(event as never);
            }}
            className={`flex-1 items-center justify-center ${focused ? '' : 'opacity-90'}`}
        >
            {children}
        </Pressable>
    );
}

export default function TabLayout() {
    const palette = usePalette();

    return (
        <Tabs
            detachInactiveScreens
            screenOptions={{
                headerShown: false,
                freezeOnBlur: true,
                lazy: true,
                tabBarStyle: {
                    backgroundColor: palette.surface,
                    borderTopColor: palette.outline,
                    height: Platform.OS === 'ios' ? 86 : 70,
                    paddingBottom: Platform.OS === 'ios' ? 26 : 12,
                    paddingTop: 9,
                },
                tabBarActiveTintColor: palette.primary,
                tabBarInactiveTintColor: palette.onSurfaceVariant,
                tabBarLabelStyle: {
                    fontWeight: '600',
                    fontSize: 10,
                    lineHeight: 14,
                    letterSpacing: 0.2,
                },
                tabBarButton: (props) => <TabButton {...props} />,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Overview',
                    tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" size={size} color={color} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="transactions"
                options={{
                    title: 'Transactions',
                    tabBarIcon: ({ color, size, focused }) => <TabIcon name="swap-horizontal" size={size} color={color} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="investments"
                options={{
                    title: 'Investments',
                    tabBarIcon: ({ color, size, focused }) => <TabIcon name="trending-up" size={size} color={color} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="accounts"
                options={{
                    title: 'Accounts',
                    tabBarIcon: ({ color, size, focused }) => <TabIcon name="wallet" size={size} color={color} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="debts"
                options={{
                    title: 'Debts',
                    tabBarIcon: ({ color, size, focused }) => <TabIcon name="trending-down" size={size} color={color} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size, focused }) => <TabIcon name="settings" size={size} color={color} focused={focused} />,
                }}
            />
        </Tabs>
    );
}
