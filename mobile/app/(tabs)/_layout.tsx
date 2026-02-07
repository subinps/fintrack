import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';

export default function TabLayout() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff', // Slate 900 : White
                    borderTopColor: isDark ? '#1e293b' : '#e4e4e7', // Slate 800 : Zinc 200
                    height: Platform.OS === 'ios' ? 85 : 60,
                    paddingBottom: Platform.OS === 'ios' ? 25 : 8,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: '#8b5cf6', // Violet 500
                tabBarInactiveTintColor: isDark ? '#64748b' : '#a1a1aa', // Slate 500 : Zinc 400
                tabBarLabelStyle: {
                    fontWeight: '600',
                    fontSize: 10,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Overview',
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="transactions"
                options={{
                    title: 'Transactions',
                    tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="investments"
                options={{
                    title: 'Investments',
                    tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="accounts"
                options={{
                    title: 'Accounts',
                    tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="debts"
                options={{
                    title: 'Debts',
                    tabBarIcon: ({ color, size }) => <Ionicons name="trending-down" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
