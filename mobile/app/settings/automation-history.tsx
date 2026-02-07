import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { AutomationHistoryService, AutomationLog } from '../../src/services/automationHistory';
import { format } from 'date-fns';

import { useAlert } from '../../src/context/AlertContext';

export default function AutomationHistoryScreen() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const [logs, setLogs] = useState<AutomationLog[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadLogs = async () => {
        const data = await AutomationHistoryService.getLogs();
        setLogs(data);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadLogs();
        setRefreshing(false);
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const handleClearLogs = () => {
        showAlert(
            "Clear History",
            "Are you sure you want to clear all automation logs?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        await AutomationHistoryService.clearLogs();
                        loadLogs();
                    }
                }
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'text-green-500';
            case 'FAILED': return 'text-red-500';
            case 'IGNORED': return 'text-gray-500';
            case 'PROCESSING': return 'text-blue-500';
            default: return 'text-onSurface';
        }
    };

    return (
        <View className="flex-1 bg-background">
            <View className="pt-12 px-4 pb-4 border-b border-outline flex-row items-center justify-between bg-surface">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-onSurface">Automation History</Text>
                <TouchableOpacity onPress={handleClearLogs} className="p-2">
                    <Ionicons name="trash-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: 20, paddingTop: 16 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />
                }
            >
                {logs.length === 0 ? (
                    <View className="items-center justify-center py-20">
                        <Ionicons name="list-outline" size={48} color="#4b5563" />
                        <Text className="text-onSurfaceVariant mt-4 text-center">No automation logs found.</Text>
                        <Text className="text-onSurfaceVariant text-xs mt-2 text-center max-w-[250px]">
                            Notifications processed by the automation system will appear here.
                        </Text>
                    </View>
                ) : (
                    logs.map((log) => (
                        <View key={log.id} className="bg-surface border border-outline rounded-xl p-4 mb-3">
                            <View className="flex-row justify-between items-start mb-2">
                                <Text className={`font-bold text-xs ${getStatusColor(log.status)}`}>
                                    {log.status}
                                </Text>
                                <Text className="text-onSurfaceVariant text-xs">
                                    {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                                </Text>
                            </View>

                            <Text className="text-onSurface font-medium mb-1">{log.result}</Text>

                            <Text className="text-onSurfaceVariant text-xs italic mb-2" numberOfLines={2}>
                                "{log.notificationText}"
                            </Text>

                            {log.details && (
                                <View className="bg-surfaceVariant rounded p-2 mt-1">
                                    <Text className="text-onSurfaceVariant text-[10px] font-mono">
                                        {JSON.stringify(log.details, null, 2)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
