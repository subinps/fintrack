import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from '../src/lib/secureStore';
import * as LocalAuthentication from 'expo-local-authentication';

export default function IndexScreen() {
    const router = useRouter();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await SecureStore.getItemAsync('token');
            if (token) {
                const biometricEnabled = await SecureStore.getItemAsync('biometric_enabled');
                if (biometricEnabled === 'true') {
                    const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: 'Unlock FinTrack',
                        disableDeviceFallback: false,
                    });

                    if (result.success) {
                        router.replace('/(tabs)');
                    } else {
                        // Biometric failed or cancelled, go to login to enter password
                        router.replace('/auth/login');
                    }
                } else {
                    router.replace('/(tabs)');
                }
            } else {
                router.replace('/auth/login');
            }
        } catch (e) {
            router.replace('/auth/login');
        }
    };

    return (
        <View className="flex-1 bg-background justify-center items-center">
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
    );
}
