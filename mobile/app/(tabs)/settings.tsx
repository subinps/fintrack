import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Switch, Platform, ActivityIndicator, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useGetUser, useChangePassword, useResetData, useDeleteUser } from '../../src/hooks/useQueries';
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../src/context/AuthContext';
import { useAlert } from '../../src/context/AlertContext';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../src/lib/api';

export default function SettingsScreen() {
    const router = useRouter();
    const { signOut } = useAuth();
    const { data: user, refetch: refetchUser } = useGetUser();
    const changePassword = useChangePassword();
    const resetData = useResetData();
    const deleteUser = useDeleteUser();
    const { showAlert } = useAlert();
    const { colorScheme, setColorScheme } = useNativeWindColorScheme();
    const isDark = colorScheme === 'dark';

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [biometricsEnabled, setBiometricsEnabled] = useState(false);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);

    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [editName, setEditName] = useState('');

    const handleUpdateProfile = async () => {
        if (!editName.trim()) {
            showAlert("Error", "Name cannot be empty");
            return;
        }
        try {
            await api.put('/auth/me', { name: editName });

            // Refetch user data to update UI
            await refetchUser();

            showAlert("Success", "Profile updated successfully");
            setShowEditProfileModal(false);
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to update profile");
        }
    };



    const [reminderTime, setReminderTime] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                await checkNotificationStatus();
                const compatible = await LocalAuthentication.hasHardwareAsync();
                setIsBiometricSupported(compatible);
                if (compatible) {
                    const enabled = await SecureStore.getItemAsync('biometric_enabled');
                    setBiometricsEnabled(enabled === 'true');
                }
            } catch (e) {
                console.warn("Notification/Biometric check failed:", e);
            }
        };
        init();
    }, []);

    const checkNotificationStatus = async () => {
        const settings = await Notifications.getPermissionsAsync();
        const isGranted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

        if (isGranted) {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            const dailyReminder = scheduled.find(n => n.content.title === "Time to track your finances! 💰");

            if (dailyReminder) {
                setNotificationsEnabled(true);
                if (dailyReminder.trigger && 'hour' in dailyReminder.trigger) {
                    const trigger = dailyReminder.trigger as any;
                    const date = new Date();
                    date.setHours(trigger.hour);
                    date.setMinutes(trigger.minute);
                    setReminderTime(date);
                }
            } else {
                setNotificationsEnabled(false);
            }
        } else {
            setNotificationsEnabled(false);
        }
    };

    const toggleNotifications = async (value: boolean) => {
        if (value) {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status === 'granted') {
                setNotificationsEnabled(true);
                await scheduleDailyNotification(reminderTime);
                showAlert("Success", `Daily reminder set for ${formatTime(reminderTime)}`);
            } else {
                showAlert("Permission Denied", "Please enable notifications in your system settings.");
                setNotificationsEnabled(false);
            }
        } else {
            await Notifications.cancelAllScheduledNotificationsAsync();
            setNotificationsEnabled(false);
        }
    };

    const scheduleDailyNotification = async (date: Date) => {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Time to track your finances! 💰",
                body: "Don't forget to log your transactions for today.",
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: date.getHours(),
                minute: date.getMinutes(),
            },
        });
    };

    const onTimeChange = async (event: any, selectedDate?: Date) => {
        setShowTimePicker(false);
        if (selectedDate) {
            setReminderTime(selectedDate);
            if (notificationsEnabled) {
                await scheduleDailyNotification(selectedDate);
            }
        }
    };

    const toggleBiometrics = async (value: boolean) => {
        try {
            if (value) {
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Authenticate to enable biometric lock',
                });
                if (result.success) {
                    await SecureStore.setItemAsync('biometric_enabled', 'true');
                    setBiometricsEnabled(true);
                    showAlert("Success", "Biometric lock enabled");
                }
            } else {
                await SecureStore.deleteItemAsync('biometric_enabled');
                setBiometricsEnabled(false);
            }
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to update biometric settings");
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleLogout = () => {
        showAlert(
            "Log Out",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Log Out",
                    style: "destructive",
                    onPress: async () => {
                        await signOut();
                    }
                }
            ]
        );
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            showAlert("Error", "Please fill in all fields");
            return;
        }
        try {
            await changePassword.mutateAsync({ currentPassword, newPassword });
            showAlert("Success", "Password changed successfully");
            setShowPasswordModal(false);
            setCurrentPassword('');
            setNewPassword('');
        } catch (error) {
            showAlert("Error", "Failed to change password");
        }
    };

    const handleResetData = () => {
        showAlert(
            "Reset Data",
            "Are you sure you want to delete all your transactions and data? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await resetData.mutateAsync();
                            showAlert("Success", "Data reset successfully");
                        } catch (error) {
                            showAlert("Error", "Failed to reset data");
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        showAlert(
            "Delete Account",
            "Are you sure you want to delete your account permanently? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteUser.mutateAsync();
                            await SecureStore.deleteItemAsync('token');
                            showAlert(
                                "Account Deleted",
                                "Your account has been successfully deleted.",
                                [
                                    {
                                        text: "OK",
                                        onPress: () => router.replace('/auth/login')
                                    }
                                ]
                            );
                        } catch (error) {
                            showAlert("Error", "Failed to delete account");
                        }
                    }
                }
            ]
        );
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/user/export');
            const data = JSON.stringify(response.data, null, 2);
            const filename = `fintrack_backup_${new Date().toISOString().split('T')[0]}.json`;
            const fileUri = FileSystem.documentDirectory + filename;

            await FileSystem.writeAsStringAsync(fileUri, data, {
                encoding: FileSystem.EncodingType.UTF8
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                showAlert("Error", "Sharing is not available on this device");
            }
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to export data");
        }
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];

            showAlert(
                "Confirm Import",
                "Importing data will create NEW accounts and transactions. It does not check for duplicates. Are you sure you want to proceed?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Import",
                        onPress: async () => {
                            try {
                                const formData = new FormData();
                                formData.append('file', {
                                    uri: file.uri,
                                    name: file.name,
                                    type: file.mimeType || 'application/json'
                                } as any);

                                await api.post('/user/import', formData, {
                                    headers: {
                                        'Content-Type': 'multipart/form-data',
                                    },
                                });
                                showAlert("Success", "Data imported successfully");
                                // Optionally refresh data
                                refetchUser();
                            } catch (error) {
                                console.error(error);
                                showAlert("Error", "Failed to import data");
                            }
                        }
                    }
                ]
            );

        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to pick file");
        }
    };

    const [isLocal, setIsLocal] = useState(false);

    useEffect(() => {
        const checkMode = async () => {
            const mode = await SecureStore.getItemAsync('app_mode');
            setIsLocal(mode === 'local');
        };
        checkMode();
    }, []);

    return (
        <View className="flex-1 bg-background">
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
                <Text className="text-4xl font-bold text-onBackground mb-8 tracking-tight">Settings</Text>

                {/* Profile Card */}
                <View className="bg-surface rounded-3xl p-5 mb-8 border border-outline flex-row items-center gap-5">
                    <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center border border-primary-500/30">
                        <Text className="text-3xl font-bold text-primary-400">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-onSurface font-bold text-xl">{user?.name || 'User'}</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setEditName(user?.name || '');
                                    setShowEditProfileModal(true);
                                }}
                                className="bg-surfaceVariant px-2 py-1 rounded-lg"
                            >
                                <Text className="text-primary text-xs font-bold">Edit</Text>
                            </TouchableOpacity>
                        </View>
                        <Text className="text-onSurfaceVariant text-sm">{user?.email || 'email@example.com'}</Text>
                    </View>
                    <TouchableOpacity
                        className="w-10 h-10 rounded-full bg-surfaceVariant items-center justify-center"
                        onPress={handleLogout}
                    >
                        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>

                {/* Appearance Section */}
                <View className="mb-8">
                    <Text className="text-primary font-bold mb-4 ml-1 uppercase text-xs tracking-widest">Appearance</Text>
                    <View className="bg-surface rounded-3xl overflow-hidden border border-outline">
                        <View className="p-4 flex-row items-center justify-between">
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center">
                                    <Ionicons name={colorScheme === 'dark' ? "moon" : "sunny"} size={20} color="#3b82f6" />
                                </View>
                                <View>
                                    <Text className="text-onSurface font-semibold text-base">Theme</Text>
                                    <Text className="text-onSurfaceVariant text-xs">
                                        {colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={colorScheme === 'dark'}
                                onValueChange={(value) => setColorScheme(value ? 'dark' : 'light')}
                                trackColor={{ false: isDark ? '#1e293b' : '#e4e4e7', true: '#8b5cf6' }}
                                thumbColor={'#ffffff'}
                            />
                        </View>
                    </View>
                </View>

                {/* Preferences Section */}
                <View className="mb-8">
                    <Text className="text-primary font-bold mb-4 ml-1 uppercase text-xs tracking-widest">Preferences</Text>
                    <View className="bg-surface rounded-3xl overflow-hidden border border-outline">
                        {/* Daily Reminder */}
                        <View className="p-4 flex-row items-center justify-between border-b border-outline">
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center">
                                    <Ionicons name="notifications" size={20} color="#a855f7" />
                                </View>
                                <View>
                                    <Text className="text-onSurface font-semibold text-base">Daily Reminder</Text>
                                    <Text className="text-onSurfaceVariant text-xs">Get notified to log transactions</Text>
                                </View>
                            </View>
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={toggleNotifications}
                                trackColor={{ false: isDark ? '#1e293b' : '#e4e4e7', true: '#8b5cf6' }}
                                thumbColor={'#ffffff'}
                            />
                        </View>

                        {notificationsEnabled && (
                            <View className="flex-row justify-between items-center p-4 bg-surfaceVariant/30">
                                <Text className="text-onSurfaceVariant text-sm ml-14">Reminder Time</Text>
                                <TouchableOpacity
                                    onPress={() => setShowTimePicker(true)}
                                    className="bg-surfaceVariant px-4 py-2 rounded-xl border border-outline"
                                >
                                    <Text className="text-primary-400 font-bold">{formatTime(reminderTime)}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* Security Section - Hide in Local Mode */}
                {!isLocal && (
                    <View className="mb-8">
                        <Text className="text-primary font-bold mb-4 ml-1 uppercase text-xs tracking-widest">Security</Text>
                        <View className="bg-surface rounded-3xl overflow-hidden border border-outline">
                            {/* Biometrics */}
                            {isBiometricSupported && (
                                <View className="p-4 flex-row items-center justify-between border-b border-outline">
                                    <View className="flex-row items-center gap-4">
                                        <View className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center">
                                            <Ionicons name="finger-print" size={20} color="#10b981" />
                                        </View>
                                        <View>
                                            <Text className="text-onSurface font-semibold text-base">Biometric Lock</Text>
                                            <Text className="text-onSurfaceVariant text-xs">Use FaceID/TouchID</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={biometricsEnabled}
                                        onValueChange={toggleBiometrics}
                                        trackColor={{ false: isDark ? '#1e293b' : '#e4e4e7', true: '#8b5cf6' }}
                                        thumbColor={'#ffffff'}
                                    />
                                </View>
                            )}

                            {/* Change Password */}
                            <TouchableOpacity
                                className="p-4 flex-row items-center justify-between active:bg-surfaceVariant"
                                onPress={() => setShowPasswordModal(true)}
                            >
                                <View className="flex-row items-center gap-4">
                                    <View className="w-10 h-10 rounded-full bg-orange-500/20 items-center justify-center">
                                        <Ionicons name="key" size={20} color="#f97316" />
                                    </View>
                                    <View>
                                        <Text className="text-onSurface font-semibold text-base">Change Password</Text>
                                        <Text className="text-onSurfaceVariant text-xs">Update your login credentials</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Data & Account Section */}
                <View className="mb-8">
                    <Text className="text-primary font-bold mb-4 ml-1 uppercase text-xs tracking-widest">Data & Account</Text>
                    <View className="bg-surface rounded-3xl overflow-hidden border border-outline">
                        <TouchableOpacity
                            className="p-4 flex-row items-center justify-between border-b border-outline active:bg-surfaceVariant"
                            onPress={() => router.push('/automation')}
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 rounded-full bg-yellow-500/20 items-center justify-center">
                                    <Ionicons name="flash" size={20} color="#eab308" />
                                </View>
                                <View>
                                    <Text className="text-onSurface font-semibold text-base">Automation</Text>
                                    <Text className="text-onSurfaceVariant text-xs">Gemini & Rules</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="p-4 flex-row items-center justify-between border-b border-outline active:bg-surfaceVariant"
                            onPress={() => router.push('/settings/categories')}
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 rounded-full bg-pink-500/20 items-center justify-center">
                                    <Ionicons name="pricetags" size={20} color="#ec4899" />
                                </View>
                                <Text className="text-onSurface font-semibold text-base">Categories</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="p-4 flex-row items-center justify-between border-b border-outline active:bg-surfaceVariant"
                            onPress={() => router.push('/chart-of-accounts')}
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center">
                                    <Ionicons name="list" size={20} color="#10b981" />
                                </View>
                                <Text className="text-onSurface font-semibold text-base">Chart of Accounts</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                        </TouchableOpacity>

                        {!isLocal && (
                            <>
                                <TouchableOpacity
                                    className="p-4 flex-row items-center justify-between border-b border-outline active:bg-surfaceVariant"
                                    onPress={handleExport}
                                >
                                    <View className="flex-row items-center gap-4">
                                        <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center">
                                            <Ionicons name="download-outline" size={20} color="#3b82f6" />
                                        </View>
                                        <Text className="text-onSurface font-semibold text-base">Export Data</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="p-4 flex-row items-center justify-between border-b border-outline active:bg-surfaceVariant"
                                    onPress={handleImport}
                                >
                                    <View className="flex-row items-center gap-4">
                                        <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center">
                                            <Ionicons name="cloud-upload-outline" size={20} color="#a855f7" />
                                        </View>
                                        <Text className="text-onSurface font-semibold text-base">Import Data</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                                </TouchableOpacity>
                            </>
                        )}

                        {!isLocal && (
                            <>
                                <TouchableOpacity
                                    className="p-4 flex-row items-center justify-between border-b border-outline active:bg-surfaceVariant"
                                    onPress={() => router.push('/settings/sessions')}
                                >
                                    <View className="flex-row items-center gap-4">
                                        <View className="w-10 h-10 rounded-full bg-indigo-500/20 items-center justify-center">
                                            <Ionicons name="shield-checkmark" size={20} color="#6366f1" />
                                        </View>
                                        <Text className="text-onSurface font-semibold text-base">Active Sessions</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="p-4 flex-row items-center justify-between border-b border-outline active:bg-surfaceVariant"
                                    onPress={handleResetData}
                                >
                                    <View className="flex-row items-center gap-4">
                                        <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center">
                                            <Ionicons name="refresh" size={20} color="#ef4444" />
                                        </View>
                                        <Text className="text-onSurface font-semibold text-base">Reset Data</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="p-4 flex-row items-center justify-between active:bg-surfaceVariant"
                                    onPress={handleDeleteAccount}
                                >
                                    <View className="flex-row items-center gap-4">
                                        <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center">
                                            <Ionicons name="trash" size={20} color="#ef4444" />
                                        </View>
                                        <Text className="text-error font-semibold text-base">Delete Account</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isDark ? "#94a3b8" : "#71717a"} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                <Text className="text-center text-onSurfaceVariant text-xs mt-4 opacity-50">
                    FinTrack
                </Text>
            </ScrollView>

            {showTimePicker && (
                <DateTimePicker
                    value={reminderTime}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={onTimeChange}
                />
            )}

            {/* Change Password Modal */}
            <Modal
                visible={showPasswordModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPasswordModal(false)}
            >
                <View className="flex-1 bg-black/80 justify-center px-6">
                    <View className="bg-surface border border-outline rounded-3xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-onBackground">Change Password</Text>
                            <TouchableOpacity onPress={() => setShowPasswordModal(false)} className="p-2 bg-surfaceVariant rounded-full">
                                <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#a1a1aa"} />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-4">
                            <View>
                                <Text className="text-onSurfaceVariant text-xs uppercase font-bold mb-2 ml-1">Current Password</Text>
                                <TextInput
                                    className="bg-background border border-outline rounded-xl px-4 py-4 text-onBackground"
                                    placeholder="Enter current password"
                                    placeholderTextColor={isDark ? "#94a3b8" : "#71717a"}
                                    secureTextEntry
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                />
                            </View>

                            <View>
                                <Text className="text-onSurfaceVariant text-xs uppercase font-bold mb-2 ml-1">New Password</Text>
                                <TextInput
                                    className="bg-background border border-outline rounded-xl px-4 py-4 text-onBackground"
                                    placeholder="Enter new password"
                                    placeholderTextColor={isDark ? "#94a3b8" : "#71717a"}
                                    secureTextEntry
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                            </View>

                            <TouchableOpacity
                                className="bg-primary-600 rounded-xl py-4 mt-4 items-center"
                                onPress={handleChangePassword}
                            >
                                <Text className="text-white font-bold text-lg">Update Password</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Profile Modal */}
            <Modal
                visible={showEditProfileModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowEditProfileModal(false)}
            >
                <View className="flex-1 bg-black/80 justify-center px-6">
                    <View className="bg-surface border border-outline rounded-3xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-onBackground">Edit Profile</Text>
                            <TouchableOpacity onPress={() => setShowEditProfileModal(false)} className="p-2 bg-surfaceVariant rounded-full">
                                <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#a1a1aa"} />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-4">
                            <View>
                                <Text className="text-onSurfaceVariant text-xs uppercase font-bold mb-2 ml-1">Your Name</Text>
                                <TextInput
                                    className="bg-background border border-outline rounded-xl px-4 py-4 text-onBackground"
                                    placeholder="Enter your name"
                                    placeholderTextColor={isDark ? "#94a3b8" : "#71717a"}
                                    value={editName}
                                    onChangeText={setEditName}
                                    autoFocus
                                />
                            </View>

                            <TouchableOpacity
                                className="bg-primary-600 rounded-xl py-4 mt-4 items-center"
                                onPress={handleUpdateProfile}
                            >
                                <Text className="text-white font-bold text-lg">Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
