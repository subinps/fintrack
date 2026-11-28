import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '../../src/context/AlertContext';

export default function LocalSetup() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const accent = isDark ? '#58B596' : '#1F6E5A';
    const muted = isDark ? '#98A6A0' : '#5A615D';
    const [name, setName] = useState('');
    const { enterLocalMode } = useAuth();
    const router = useRouter();
    const { showAlert } = useAlert();

    const handleContinue = async () => {
        if (!name.trim()) {
            showAlert('Error', 'Please enter your name to continue.');
            return;
        }

        try {
            await enterLocalMode(name);
            // AuthContext will handle navigation to (tabs)
        } catch (error) {
            console.error('Local Setup Error:', error);
            showAlert('Error', 'Failed to setup local profile.');
        }
    };

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <LinearGradient
                colors={isDark ? ['#0D1210', '#131A17', '#0D1210'] : ['#F7F5F0', '#FEFDFB', '#F7F5F0']}
                className="absolute inset-0"
            />

            {/* Background Blobs */}
            <View pointerEvents="none" className="absolute top-[-50] left-[-100] w-[300] h-[300] bg-primary/10 rounded-full blur-3xl" />
            <View pointerEvents="none" className="absolute bottom-[-100] right-[-50] w-[250] h-[250] bg-success/10 rounded-full blur-3xl" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
                >
                    <Animated.View entering={FadeInDown.delay(120).springify()} className="items-center mb-10">
                        <View className="w-20 h-20 bg-primary/10 rounded-3xl items-center justify-center mb-6 border border-primary/25">
                            <Ionicons name="phone-portrait-outline" size={40} color={accent} />
                        </View>
                        <Text className="text-4xl font-bold text-onSurface tracking-tight text-center">
                            Offline Mode
                        </Text>
                        <Text className="text-onSurfaceVariant mt-3 text-base text-center px-4 leading-6">
                            Your data stays on this device. No internet required, complete privacy.
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(260).springify()} className="bg-surface border border-outline rounded-[32px] p-8 space-y-6">
                        <View className="space-y-2">
                            <Text className="text-onSurfaceVariant ml-1 font-medium text-sm uppercase tracking-wider">Your Name</Text>
                            <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-2xl px-4 h-16">
                                <Ionicons name="person-outline" size={22} color={muted} />
                                <TextInput
                                    className="flex-1 text-onSurface ml-3 text-lg font-medium"
                                    placeholder="e.g. John Doe"
                                    placeholderTextColor={muted}
                                    value={name}
                                    onChangeText={setName}
                                    autoFocus
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleContinue}
                            className="bg-primary h-16 rounded-2xl flex-row items-center justify-center mt-4 active:opacity-80 active:scale-95 transition-transform"
                        >
                            <Text className="text-primary-foreground font-bold text-xl tracking-wide">Get Started</Text>
                            <Ionicons name="arrow-forward" size={24} color={isDark ? '#0A1710' : '#FBFAF7'} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </Animated.View>

                    <View className="flex-row justify-center mt-12">
                        <TouchableOpacity
                            onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))}
                            className="flex-row items-center space-x-2 opacity-80 active:opacity-100 py-2 px-3"
                            accessibilityRole="button"
                            accessibilityLabel="Back to login"
                        >
                            <Ionicons name="arrow-back" size={18} color={muted} />
                            <Text className="text-onSurfaceVariant font-medium text-base">Back to Login</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
