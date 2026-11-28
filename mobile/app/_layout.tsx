import '../global.css';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/context/AuthContext';
import { AlertProvider } from '../src/context/AlertContext';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';

// Configure Reanimated logger to suppress strict mode warnings
configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
});

import BiometricLock from '../src/components/BiometricLock';
import { LogBox, View } from 'react-native';
import * as Notifications from 'expo-notifications';

LogBox.ignoreLogs([
    'You are setting the style `{ shadowOffset: ... }` as a prop',
]);

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const queryClient = new QueryClient();

export default function RootLayout() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <View style={{ flex: 1 }} className={colorScheme}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <QueryClientProvider client={queryClient}>
                    <AuthProvider>
                        <AlertProvider>
                            <BiometricLock>
                                <StatusBar style={isDark ? 'light' : 'dark'} />
                                <Stack
                                    screenOptions={{
                                        headerShown: false,
                                        contentStyle: { backgroundColor: isDark ? '#080a14' : '#f6f7fb' },
                                    }}
                                >
                                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                    <Stack.Screen name="trash" options={{ headerShown: false, animation: 'slide_from_right' }} />
                                    <Stack.Screen name="notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
                                    <Stack.Screen name="auth/login" options={{ headerShown: false, animation: 'fade' }} />
                                    <Stack.Screen name="auth/register" options={{ headerShown: false, animation: 'slide_from_right' }} />
                                    <Stack.Screen name="auth/forgot-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
                                    <Stack.Screen name="auth/local-setup" options={{ headerShown: false, animation: 'slide_from_right' }} />

                                    <Stack.Screen
                                        name="add-transaction"
                                        options={{
                                            presentation: 'modal',
                                            headerShown: false
                                        }}
                                    />
                                    <Stack.Screen
                                        name="add-account"
                                        options={{
                                            presentation: 'modal',
                                            headerShown: false
                                        }}
                                    />
                                    <Stack.Screen
                                        name="add-investment"
                                        options={{
                                            presentation: 'modal',
                                            headerShown: false
                                        }}
                                    />
                                    <Stack.Screen
                                        name="edit-transaction/[id]"
                                        options={{
                                            presentation: 'modal',
                                            headerShown: false
                                        }}
                                    />
                                    <Stack.Screen
                                        name="edit-account/[id]"
                                        options={{
                                            presentation: 'modal',
                                            headerShown: false
                                        }}
                                    />
                                    <Stack.Screen
                                        name="edit-investment/[id]"
                                        options={{
                                            presentation: 'modal',
                                            headerShown: false
                                        }}
                                    />
                                </Stack>
                            </BiometricLock>
                        </AlertProvider>
                    </AuthProvider>
                </QueryClientProvider>
            </GestureHandlerRootView>
        </View>
    );
}
