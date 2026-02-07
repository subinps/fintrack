import { useState, useEffect, useRef } from 'react';
import { View, Text, AppState, AppStateStatus, TouchableOpacity, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BiometricLock({ children }: { children: React.ReactNode }) {
    const [isLocked, setIsLocked] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const appState = useRef(AppState.currentState);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        checkBiometricStatus();

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);

    const checkBiometricStatus = async () => {
        const enabled = await SecureStore.getItemAsync('biometric_enabled');
        setIsEnabled(enabled === 'true');
    };

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (
            appState.current.match(/inactive|background/) &&
            nextAppState === 'active'
        ) {
            // App coming to foreground
            const enabled = await SecureStore.getItemAsync('biometric_enabled');
            if (enabled === 'true') {
                setIsLocked(true);
                authenticate();
            }
        }
        appState.current = nextAppState;
    };

    const authenticate = async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                // Fallback or disable if not available
                setIsLocked(false);
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock FinTrack',
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
            });

            if (result.success) {
                setIsLocked(false);
            }
        } catch (error) {
            console.error("Authentication error:", error);
        }
    };

    if (isLocked) {
        return (
            <View className="flex-1 bg-background items-center justify-center z-50 absolute top-0 left-0 right-0 bottom-0">
                <View className="items-center">
                    <View className="w-24 h-24 rounded-full bg-primary-500/20 items-center justify-center mb-6">
                        <Ionicons name="lock-closed" size={48} color="#3b82f6" />
                    </View>
                    <Text className="text-2xl font-bold text-onSurface mb-2">FinTrack Locked</Text>
                    <Text className="text-onSurfaceVariant mb-8">Unlock to access your finances</Text>

                    <TouchableOpacity
                        onPress={authenticate}
                        className="bg-primary-600 px-8 py-4 rounded-2xl flex-row items-center"
                    >
                        <Ionicons name="finger-print" size={24} color="white" style={{ marginRight: 10 }} />
                        <Text className="text-white font-bold text-lg">Unlock</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return <>{children}</>;
}
