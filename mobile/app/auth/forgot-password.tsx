import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useAlert } from '../../src/context/AlertContext';

export default function ForgotPassword() {
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
            <View className="flex-1 bg-slate-950 justify-center items-center p-6">
                <LinearGradient
                    colors={['#020617', '#0f172a', '#020617']}
                    className="absolute inset-0"
                />
                <View className="bg-slate-900/80 border border-slate-800 rounded-[40px] p-10 items-center space-y-8 w-full max-w-sm">
                    <View className="w-24 h-24 bg-blue-500/10 rounded-full items-center justify-center mb-2 border border-blue-500/20">
                        <Ionicons name="mail" size={48} color="#3b82f6" />
                    </View>

                    <View className="items-center space-y-2">
                        <Text className="text-3xl font-bold text-white text-center">Check Inbox</Text>
                        <Text className="text-slate-400 text-center text-base leading-6 px-2">
                            If an account exists for <Text className="text-blue-400 font-semibold">{email}</Text>, you'll receive a password reset link shortly.
                        </Text>
                    </View>

                    <View className="w-full space-y-4 pt-4">
                        <TouchableOpacity
                            onPress={() => router.replace('/auth/login')}
                            className="bg-blue-600 h-16 rounded-2xl items-center justify-center w-full active:bg-blue-700"
                        >
                            <Text className="text-white font-bold text-lg">Back to Login</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleResendLink}
                            disabled={resending}
                            className="h-14 rounded-2xl items-center justify-center w-full border border-slate-700 active:bg-slate-800"
                        >
                            {resending ? (
                                <ActivityIndicator color="#94a3b8" />
                            ) : (
                                <Text className="text-slate-300 font-semibold">Resend Link</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-950">
            <LinearGradient
                colors={['#020617', '#0f172a', '#020617']}
                className="absolute inset-0"
            />

            {/* Background Blobs */}
            <View className="absolute top-[-50] left-[-50] w-[300] h-[300] bg-blue-500/10 rounded-full blur-3xl" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="absolute top-12 left-6 w-12 h-12 bg-slate-900/50 rounded-full items-center justify-center border border-slate-800"
                    >
                        <Ionicons name="arrow-back" size={24} color="#94a3b8" />
                    </TouchableOpacity>

                    <View className="items-center mb-10 mt-12">
                        <View className="w-16 h-16 bg-blue-500/10 rounded-2xl items-center justify-center mb-4 border border-blue-500/20">
                            <Ionicons name="key-outline" size={32} color="#3b82f6" />
                        </View>
                        <Text className="text-4xl font-bold text-white tracking-tight text-center">
                            Forgot Password?
                        </Text>
                        <Text className="text-slate-400 mt-2 text-base text-center px-6">
                            Enter your email and we'll send you instructions to reset your password.
                        </Text>
                    </View>

                    <View className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-6 space-y-6">
                        {error && (
                            <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex-row items-center">
                                <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
                                <Text className="text-red-400 ml-2 font-medium flex-1">{error}</Text>
                            </View>
                        )}
                        <View className="space-y-2">
                            <Text className="text-slate-400 ml-1 font-medium text-sm">Email Address</Text>
                            <View className="flex-row items-center bg-slate-950/50 border border-slate-800 rounded-2xl px-4 h-14">
                                <Ionicons name="mail-outline" size={20} color="#64748b" />
                                <TextInput
                                    className="flex-1 text-white ml-3 text-base"
                                    placeholder="name@example.com"
                                    placeholderTextColor="#475569"
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
                            className="bg-blue-600 h-16 rounded-2xl items-center justify-center mt-2 active:bg-blue-700"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Send Reset Link</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mt-8 self-center"
                    >
                        <Text className="text-slate-500 font-medium">Remember your password? <Text className="text-blue-400 font-bold">Sign In</Text></Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
