import { View, Text, TouchableOpacity, Switch, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotificationStore, AppInfo } from '../../src/services/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from '../../src/lib/secureStore';
import { getGeminiApiKey, setGeminiApiKey } from '../../src/services/gemini';
import { useTransactionAutomation } from '../../src/hooks/useTransactionAutomation';
import { useAlert } from '../../src/context/AlertContext';
import { useInstalledApps, InstalledApp } from '../../src/hooks/useInstalledApps';

// --- Reusable Components ---

const SettingsSection = ({ title, children, footer }: { title?: string, children: React.ReactNode, footer?: string }) => (
    <View className="mb-6">
        {title && <Text className="text-onSurfaceVariant text-xs font-bold uppercase ml-4 mb-2 tracking-wider">{title}</Text>}
        <View className="bg-surface rounded-xl overflow-hidden border border-outline shadow-sm">
            {children}
        </View>
        {footer && <Text className="text-onSurfaceVariant text-xs ml-4 mt-2 pr-4 leading-4">{footer}</Text>}
    </View>
);

const SettingsRow = ({
    icon,
    iconColor = '#3b82f6',
    label,
    subLabel,
    isLast = false,
    children,
    onPress
}: {
    icon?: keyof typeof Ionicons.glyphMap,
    iconColor?: string,
    label: string,
    subLabel?: string,
    isLast?: boolean,
    children?: React.ReactNode,
    onPress?: () => void
}) => {
    const Content = (
        <View className={`flex-row items-center p-4 bg-surface ${!isLast ? 'border-b border-outline' : ''}`}>
            {icon && (
                <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3`} style={{ backgroundColor: `${iconColor}15` }}>
                    <Ionicons name={icon} size={18} color={iconColor} />
                </View>
            )}
            <View className="flex-1 mr-2">
                <Text className="text-onSurface font-medium text-base">{label}</Text>
                {subLabel && <Text className="text-onSurfaceVariant text-xs mt-0.5" numberOfLines={1}>{subLabel}</Text>}
            </View>
            {children}
        </View>
    );

    if (onPress) {
        return <TouchableOpacity onPress={onPress}>{Content}</TouchableOpacity>;
    }
    return Content;
};

// --- Main Screen ---

export default function AutomationSettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();
    const { hasPermission, requestPermission, isProcessing } = useTransactionAutomation();
    const [showSystemApps, setShowSystemApps] = useState(false);
    const { apps: installedApps, isLoading: isLoadingApps } = useInstalledApps(showSystemApps);

    const [whitelisted, setWhitelisted] = useState<AppInfo[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Settings State
    const [geminiKey, setGeminiKey] = useState('');
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [keywords, setKeywords] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [w, key, kws] = await Promise.all([
                NotificationStore.getWhitelistedApps(),
                getGeminiApiKey(),
                SecureStore.getItemAsync('notification_keywords')
            ]);
            setWhitelisted(w);
            if (key) setGeminiKey(key);
            if (kws) setKeywords(kws);
        } catch (error) {
            console.error("Failed to load automation settings", error);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const toggleWhitelist = async (app: InstalledApp | AppInfo, enable: boolean) => {
        if (enable) {
            await NotificationStore.addWhitelistedApp({
                packageName: app.packageName,
                appName: app.appName,
                lastSeen: new Date().toISOString()
            });
        } else {
            await NotificationStore.removeWhitelistedApp(app.packageName);
        }
        loadData();
    };

    const filteredApps = installedApps.filter(app =>
        app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.packageName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            await setGeminiApiKey(geminiKey);
            await SecureStore.setItemAsync('notification_keywords', keywords);
            // Simulate a small delay for feedback
            await new Promise(resolve => setTimeout(resolve, 500));
            showAlert("Success", "Settings saved successfully");
        } catch (error) {
            console.error("Failed to save settings", error);
            showAlert("Error", "Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const renderHeader = () => (
        <View className="px-4 py-6">
            {/* AI Configuration */}
            <SettingsSection title="AI Configuration" footer="The Gemini API Key is used to parse notification text into transaction data.">
                <View className="p-4 bg-surface border-b border-outline">
                    <Text className="text-onSurface font-medium mb-2">Gemini API Key</Text>
                    <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-lg px-3">
                        <TextInput
                            className="flex-1 py-3 text-onSurface"
                            placeholder="Enter API Key"
                            placeholderTextColor="#9ca3af"
                            secureTextEntry={!showGeminiKey}
                            value={geminiKey}
                            onChangeText={setGeminiKey}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowGeminiKey(!showGeminiKey)} className="p-2">
                            <Ionicons name={showGeminiKey ? "eye-off" : "eye"} size={20} color="#6b7280" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View className="p-4 bg-surface">
                    <Text className="text-onSurface font-medium mb-2">Keywords</Text>
                    <TextInput
                        className="bg-surfaceVariant border border-outline rounded-lg px-3 py-3 text-onSurface h-24"
                        placeholder="spent, debited, credited..."
                        placeholderTextColor="#9ca3af"
                        value={keywords}
                        onChangeText={setKeywords}
                        multiline
                        textAlignVertical="top"
                    />
                </View>
            </SettingsSection>

            {/* Permissions */}
            <SettingsSection title="Permissions">
                <SettingsRow
                    icon="notifications"
                    iconColor="#8b5cf6"
                    label="Notification Access"
                    subLabel={hasPermission ? "Active" : "Required to read notifications"}
                    onPress={hasPermission ? undefined : requestPermission}
                    isLast
                >
                    {isProcessing ? (
                        <ActivityIndicator size="small" color="#8b5cf6" />
                    ) : (
                        <View className="flex-row items-center">
                            <Text className={`text-sm mr-2 ${hasPermission ? 'text-green-600' : 'text-onSurfaceVariant'}`}>
                                {hasPermission ? 'On' : 'Off'}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                        </View>
                    )}
                </SettingsRow>
            </SettingsSection>

            {/* All Installed Apps Header */}
            <View className="mb-2">
                <Text className="text-onSurfaceVariant text-xs font-bold uppercase ml-4 mb-2 tracking-wider">All Installed Apps</Text>
                <View className="bg-surface rounded-t-xl overflow-hidden border-x border-t border-outline shadow-sm">
                    <SettingsRow
                        icon="layers"
                        iconColor="#6366f1"
                        label="Show System Apps"
                        subLabel="Include pre-installed applications"
                    >
                        <Switch
                            value={showSystemApps}
                            onValueChange={setShowSystemApps}
                            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                        />
                    </SettingsRow>

                    <View className="p-4 bg-surface border-b border-outline">
                        <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-lg px-3">
                            <Ionicons name="search" size={20} color="#9ca3af" />
                            <TextInput
                                className="flex-1 py-3 px-2 text-onSurface"
                                placeholder="Search apps..."
                                placeholderTextColor="#9ca3af"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={20} color="#9ca3af" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderAppItem = ({ item: app, index }: { item: InstalledApp, index: number }) => {
        const isWhitelisted = whitelisted.some(w => w.packageName === app.packageName);
        const isLast = index === filteredApps.length - 1;

        return (
            <View className="px-4">
                <View className={`bg-surface border-x border-outline ${isLast ? 'rounded-b-xl border-b mb-6' : 'border-b'}`}>
                    <SettingsRow
                        icon="cube-outline"
                        iconColor={isWhitelisted ? "#10b981" : "#6b7280"}
                        label={app.appName}
                        subLabel={app.packageName}
                        isLast={true} // We handle borders manually in the wrapper View
                    >
                        <Switch
                            value={isWhitelisted}
                            onValueChange={(val) => toggleWhitelist(app, val)}
                            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                        />
                    </SettingsRow>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View style={{ paddingTop: insets.top }} className="pb-4 px-4 bg-surface border-b border-outline z-10">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-surfaceVariant">
                        <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-onSurface">Automation Settings</Text>
                    <TouchableOpacity onPress={saveSettings} disabled={isSaving} className="p-2 -mr-2">
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#3b82f6" />
                        ) : (
                            <Text className="text-primary-600 font-semibold text-base">Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                {isLoadingApps ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text className="text-onSurfaceVariant mt-4">Loading apps...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredApps}
                        renderItem={renderAppItem}
                        keyExtractor={item => item.packageName}
                        ListHeaderComponent={renderHeader}
                        ListEmptyComponent={
                            <View className="p-8 items-center justify-center">
                                <Text className="text-onSurfaceVariant italic">No apps found</Text>
                            </View>
                        }
                        contentContainerStyle={{ paddingBottom: 20 }}
                        initialNumToRender={20}
                        maxToRenderPerBatch={20}
                        windowSize={10}
                    />
                )}
            </KeyboardAvoidingView>
        </View>
    );
}
