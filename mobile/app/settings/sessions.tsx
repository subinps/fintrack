import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useGetSessions, useRevokeSession, useRevokeOtherSessions, Session } from '../../src/hooks/useQueries';
import { formatDistanceToNow } from 'date-fns';
import { useColorScheme } from 'nativewind';

import { useAlert } from '../../src/context/AlertContext';

export default function ActiveSessionsScreen() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const { data: sessions, isLoading, refetch } = useGetSessions();
    const revokeSession = useRevokeSession();
    const revokeOtherSessions = useRevokeOtherSessions();
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [verifying, setVerifying] = useState(false);

    const handleRevoke = (sessionId: string) => {
        showAlert(
            "Revoke Session",
            "Are you sure you want to log out this device?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Revoke",
                    style: "destructive",
                    onPress: async () => {
                        setRevokingId(sessionId);
                        try {
                            await revokeSession.mutateAsync(sessionId);
                            refetch();
                        } catch (error) {
                            showAlert("Error", "Failed to revoke session");
                        } finally {
                            setRevokingId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleRevokeOthersClick = () => {
        setPassword('');
        setShowPasswordModal(true);
    };

    const confirmRevokeOthers = async () => {
        if (!password) {
            showAlert("Error", "Please enter your password");
            return;
        }
        setVerifying(true);
        try {
            await revokeOtherSessions.mutateAsync(password);
            setShowPasswordModal(false);
            showAlert("Success", "All other sessions have been revoked.");
            refetch();
        } catch (error: any) {
            const message = error.response?.data?.error || "Failed to revoke sessions. Check your password.";
            showAlert("Error", message);
        } finally {
            setVerifying(false);
        }
    };

    const getDeviceIcon = (deviceString: string) => {
        const lower = deviceString.toLowerCase();
        if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) return 'phone-portrait-outline';
        if (lower.includes('mac') || lower.includes('windows') || lower.includes('linux')) return 'laptop-outline';
        return 'globe-outline';
    };

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{
                headerShown: true,
                title: 'Active Sessions',
                headerStyle: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                headerTintColor: isDark ? '#fff' : '#000',
                headerTitleStyle: { fontWeight: 'bold' },
            }} />

            <ScrollView className="flex-1 px-4 py-6">
                <Text className="text-onSurfaceVariant text-sm mb-6">
                    Manage the devices where you are currently logged in.
                </Text>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#3b82f6" />
                ) : (
                    <View className="space-y-4">
                        {sessions?.map((session) => (
                            <View
                                key={session.id}
                                className={`rounded-2xl overflow-hidden border ${session.isCurrent ? 'border-blue-500/50 bg-blue-500/10' : 'border-outline bg-surface'}`}
                            >
                                <View className="p-4">
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center flex-1">
                                            <View className={`w-10 h-10 rounded-full items-center justify-center ${session.isCurrent ? 'bg-blue-500/20' : 'bg-surfaceVariant'}`}>
                                                <Ionicons name={getDeviceIcon(session.device || '')} size={20} color={session.isCurrent ? '#60a5fa' : (isDark ? '#94a3b8' : '#64748b')} />
                                            </View>
                                            <View className="ml-3 flex-1">
                                                <View className="flex-row items-center">
                                                    <Text className="text-onSurface font-semibold text-base" numberOfLines={1}>
                                                        {session.device || 'Unknown Device'}
                                                    </Text>
                                                    {session.isCurrent && (
                                                        <View className="ml-2 px-2 py-0.5 bg-blue-500/20 rounded-full border border-blue-500/30">
                                                            <Text className="text-blue-400 text-[10px] font-bold">CURRENT</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text className="text-onSurfaceVariant text-xs mt-1">
                                                    {session.ip} • Last active {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                                                </Text>
                                            </View>
                                        </View>

                                        {!session.isCurrent && (
                                            <TouchableOpacity
                                                onPress={() => handleRevoke(session.id)}
                                                disabled={revokingId === session.id}
                                                className="p-2"
                                            >
                                                {revokingId === session.id ? (
                                                    <ActivityIndicator size="small" color="#ef4444" />
                                                ) : (
                                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {sessions && sessions.length > 1 && (
                    <TouchableOpacity
                        onPress={handleRevokeOthersClick}
                        className="mt-8 bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex-row items-center justify-center active:bg-red-500/20"
                    >
                        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                        <Text className="text-red-400 font-semibold ml-2">Log Out All Other Devices</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Password Confirmation Modal */}
            <Modal
                visible={showPasswordModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPasswordModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 bg-black/80 justify-center px-6"
                >
                    <View className="bg-surface border border-outline rounded-2xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-onSurface">Confirm Logout</Text>
                            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                                <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-onSurfaceVariant mb-4">
                            Please enter your password to confirm logging out all other devices.
                        </Text>

                        <View className="bg-surfaceVariant border border-outline rounded-xl px-4 py-3 mb-6 flex-row items-center">
                            <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                            <TextInput
                                className="flex-1 text-onSurface ml-3 text-base"
                                placeholder="Enter your password"
                                placeholderTextColor="#64748b"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            className="bg-red-600 h-12 rounded-xl items-center justify-center flex-row"
                            onPress={confirmRevokeOthers}
                            disabled={verifying}
                        >
                            {verifying ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Log Out Others</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
