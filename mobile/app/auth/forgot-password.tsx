import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useAlert } from '../../src/context/AlertContext';

export default function ForgotPassword() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const accent = isDark ? '#58B596' : '#1F6E5A';
    const muted = isDark ? '#98A6A0' : '#5A615D';
    const danger = isDark ? '#DE7060' : '#AA3928';
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { showAlert } = useAlert();

    const handleReset = async () => {
        setError(null);
        if (!email) {
            setError('Please enter your email address');
            return;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSuccess(true);
        } catch (error: any) {
            console.error('Reset error:', error);
            setError(error.response?.data?.error || 'Failed to send reset link. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendLink = async () => {
        setResending(true);
        try {
            await api.post('/auth/forgot-password', { email });
            showAlert('Success', 'Reset link resent successfully!');
        } catch (error: any) {
            showAlert('Error', error.response?.data?.error || 'Failed to resend reset link');
        } finally {
            setResending(false);
        }
    };

    if (success) {
        return (
            <View className="flex-1 bg-background justify-center items-center p-6">
                <LinearGradient
                    colors={isDark ? ['#0D1210', '#131A17', '#0D1210'] : ['#F7F5F0', '#FEFDFB', '#F7F5F0']}
                    className="absolute inset-0"
                />
                <Animated.View entering={FadeInUp.springify()} className="bg-surface border border-outline rounded-[40px] p-10 items-center space-y-8 w-full max-w-sm">
                    <View className="w-24 h-24 bg-primary/10 rounded-full items-center justify-center mb-2 border border-primary/25">
                        <Ionicons name="mail" size={48} color={accent} />
                    </View>

                    <View className="items-center space-y-2">
                        <Text className="text-3xl font-bold text-onSurface text-center">Check Inbox</Text>
                        <Text className="text-onSurfaceVariant text-center text-base leading-6 px-2">
                            If an account exists for <Text className="text-primary font-semibold">{email}</Text>, you'll receive a password reset link shortly.
                        </Text>
                    </View>

                    <View className="w-full space-y-4 pt-4">
                        <TouchableOpacity
                            onPress={() => router.replace('/auth/login')}
                            className="bg-primary h-16 rounded-2xl items-center justify-center w-full active:opacity-80"
                        >
                            <Text className="text-primary-foreground font-bold text-lg">Back to Login</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleResendLink}
                            disabled={resending}
                            className="h-14 rounded-2xl items-center justify-center w-full border border-outline active:bg-surfaceVariant"
                        >
                            {resending ? (
                                <ActivityIndicator color={muted} />
                            ) : (
                                <Text className="text-onSurface font-semibold">Resend Link</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <LinearGradient
                colors={isDark ? ['#0D1210', '#131A17', '#0D1210'] : ['#F7F5F0', '#FEFDFB', '#F7F5F0']}
                className="absolute inset-0"
            />

            {/* Background Blob */}
            <View pointerEvents="none" className="absolute top-[-50] left-[-50] w-[300] h-[300] bg-primary/10 rounded-full blur-3xl" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
                >
                    <TouchableOpacity
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))}
                        className="absolute top-12 left-6 w-12 h-12 bg-surface rounded-full items-center justify-center border border-outline active:opacity-70"
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color={muted} />
                    </TouchableOpacity>

                    <Animated.View entering={FadeInDown.delay(120).springify()} className="items-center mb-10 mt-12">
                        <View className="w-16 h-16 bg-primary/10 rounded-2xl items-center justify-center mb-4 border border-primary/25">
                            <Ionicons name="key-outline" size={32} color={accent} />
                        </View>
                        <Text className="text-4xl font-bold text-onSurface tracking-tight text-center">
                            Forgot Password?
                        </Text>
                        <Text className="text-onSurfaceVariant mt-2 text-base text-center px-6">
                            Enter your email and we'll send you instructions to reset your password.
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(260).springify()} className="bg-surface border border-outline rounded-[32px] p-6 space-y-6">
                        {error && (
                            <Animated.View entering={FadeInDown.duration(180)} className="bg-error/10 border border-error/25 p-4 rounded-2xl flex-row items-center">
                                <Ionicons name="alert-circle-outline" size={20} color={danger} />
                                <Text className="text-error ml-2 font-medium flex-1">{error}</Text>
                            </Animated.View>
                        )}
                        <View className="space-y-2">
                            <Text className="text-onSurfaceVariant ml-1 font-medium text-sm">Email Address</Text>
                            <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-2xl px-4 h-14">
                                <Ionicons name="mail-outline" size={20} color={muted} />
                                <TextInput
                                    className="flex-1 text-onSurface ml-3 text-base"
                                    placeholder="name@example.com"
                                    placeholderTextColor={muted}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleReset}
                            disabled={loading}
                            className="bg-primary h-16 rounded-2xl items-center justify-center mt-2 active:opacity-80"
                        >
                            {loading ? (
                                <ActivityIndicator color={isDark ? '#0A1710' : '#FBFAF7'} />
                            ) : (
                                <Text className="text-primary-foreground font-bold text-lg">Send Reset Link</Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    <TouchableOpacity
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))}
                        className="mt-8 self-center py-2"
                    >
                        <Text className="text-onSurfaceVariant font-medium">Remember your password? <Text className="text-primary font-bold">Sign In</Text></Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
