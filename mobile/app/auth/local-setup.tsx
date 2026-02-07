import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '../../src/context/AlertContext';

export default function LocalSetup() {
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
        <View className="flex-1 bg-slate-950">
            <LinearGradient
                colors={['#020617', '#0f172a', '#020617']}
                className="absolute inset-0"
            />

            {/* Background Blobs */}
            <View className="absolute top-[-50] left-[-100] w-[300] h-[300] bg-blue-500/10 rounded-full blur-3xl" />
            <View className="absolute bottom-[-100] right-[-50] w-[250] h-[250] bg-emerald-500/10 rounded-full blur-3xl" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
                >
                    <View className="items-center mb-10">
                        <View className="w-20 h-20 bg-blue-500/10 rounded-3xl items-center justify-center mb-6 border border-blue-500/20">
                            <Ionicons name="phone-portrait-outline" size={40} color="#60a5fa" />
                        </View>
                        <Text className="text-4xl font-bold text-white tracking-tight text-center">
                            Offline Mode
                        </Text>
                        <Text className="text-slate-400 mt-3 text-base text-center px-4 leading-6">
                            Your data stays on this device. No internet required, complete privacy.
                        </Text>
                    </View>

                    <View className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 space-y-6">
                        <View className="space-y-2">
                            <Text className="text-slate-400 ml-1 font-medium text-sm uppercase tracking-wider">Your Name</Text>
                            <View className="flex-row items-center bg-slate-950/50 border border-slate-800 rounded-2xl px-4 h-16">
                                <Ionicons name="person-outline" size={22} color="#64748b" />
                                <TextInput
                                    className="flex-1 text-white ml-3 text-lg font-medium"
                                    placeholder="e.g. John Doe"
                                    placeholderTextColor="#475569"
                                    value={name}
                                    onChangeText={setName}
                                    autoFocus
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleContinue}
                            className="bg-blue-600 h-16 rounded-2xl flex-row items-center justify-center mt-4 active:bg-blue-700 shadow-lg shadow-blue-900/20"
                        >
                            <Text className="text-white font-bold text-xl tracking-wide">Get Started</Text>
                            <Ionicons name="arrow-forward" size={24} color="white" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row justify-center mt-12">
                        <Link href="/auth/login" asChild>
                            <TouchableOpacity className="flex-row items-center space-x-2 opacity-80 active:opacity-100">
                                <Ionicons name="arrow-back" size={18} color="#94a3b8" />
                                <Text className="text-slate-400 font-medium text-base">Back to Login</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
