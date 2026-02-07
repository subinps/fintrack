import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, TextInput, Switch } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NotificationStore, PendingNotification, AppInfo } from '../../src/services/notificationStore';
import { AutomationHistoryService, AutomationLog } from '../../src/services/automationHistory';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGeminiApiKey, processBatchNotifications } from '../../src/services/gemini';
import api from '../../src/lib/api';
import { useGetTransactions } from '../../src/hooks/useQueries';
import { useAlert } from '../../src/context/AlertContext';

type Tab = 'PENDING' | 'HISTORY';

export default function AutomationHubScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();
    const [activeTab, setActiveTab] = useState<Tab>('PENDING');
    const [isLoading, setIsLoading] = useState(false);

    // Data State
    const [pending, setPending] = useState<PendingNotification[]>([]);
    const [history, setHistory] = useState<AutomationLog[]>([]);

    // Selection State
    const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());

    // Fetch transactions for status lookup
    // We fetch both DRAFT and COMPLETED to check where the transaction lives
    const { data: drafts } = useGetTransactions('DRAFT');
    const { data: completed } = useGetTransactions('COMPLETED');

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [p, h] = await Promise.all([
                NotificationStore.getPending(),
                AutomationHistoryService.getLogs()
            ]);
            setPending(p);
            setHistory(h);
        } catch (error) {
            console.error("Failed to load automation data", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedPending);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedPending(newSet);
    };

    const handleProcess = async () => {
        if (selectedPending.size === 0) {
            showAlert("Select Notifications", "Please select at least one notification to process.");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Get Data
            const apiKey = await getGeminiApiKey();
            if (!apiKey) {
                showAlert("Error", "Gemini API Key not found. Please set it in Settings.");
                return;
            }

            const accountsRes = await api.get('/accounts');
            const accounts = accountsRes.data;
            const accountNames = accounts.map((a: any) => a.name);

            // 2. Prepare Notifications
            const notificationsToProcess = pending.filter(n => selectedPending.has(n.id));

            // 2.1 Ensure Suspense Account Exists
            let suspenseAccount = accounts.find((a: any) => a.name.toLowerCase() === 'suspense');
            if (!suspenseAccount) {
                try {
                    const res = await api.post('/accounts', {
                        name: 'Suspense',
                        type: 'ASSET', // Default type, user can change
                        subType: 'Other'
                    });
                    suspenseAccount = res.data;
                    accounts.push(suspenseAccount); // Add to local list
                } catch (e) {
                    console.error("Failed to create Suspense account", e);
                    showAlert("Error", "Failed to create 'Suspense' account for unknown transactions.");
                    setIsLoading(false);
                    return;
                }
            }
            const suspenseId = suspenseAccount.id;

            // 3. Call Gemini Batch
            const transactions = await processBatchNotifications(
                notificationsToProcess.map(n => ({
                    id: n.id,
                    text: n.text,
                    timestamp: n.timestamp,
                    appName: n.appName
                })),
                apiKey,
                accountNames
            );

            if (transactions.length === 0) {
                showAlert("No Transactions Found", "Gemini couldn't identify any transactions.");
                return;
            }

            // 4. Create Drafts & Map IDs
            let createdCount = 0;
            let failedCount = 0;

            // Map: NotificationID -> Array of Created Transaction IDs
            const notifToTxMap = new Map<string, number[]>();

            for (let i = 0; i < transactions.length; i++) {
                const tx = transactions[i];

                const resolveId = (name: string | null) => {
                    if (!name) return suspenseId;
                    const acc = accounts.find((a: any) => a.name.toLowerCase() === name.toLowerCase());
                    return acc ? acc.id : suspenseId;
                };

                const sourceId = resolveId(tx.sourceAccount);
                const destId = resolveId(tx.destinationAccount);

                try {
                    const res = await api.post('/transactions', {
                        description: tx.description || "Auto-Draft",
                        date: tx.date || new Date().toISOString(),
                        splits: [
                            {
                                accountId: tx.type === 'INCOME' ? destId : sourceId,
                                amount: Math.round(Math.abs(tx.amount) * 100).toString(),
                            },
                            {
                                accountId: tx.type === 'INCOME' ? sourceId : destId,
                                amount: Math.round(-(Math.abs(tx.amount) * 100)).toString(),
                            }
                        ],
                        status: 'DRAFT'
                    });
                    createdCount++;

                    if (res.data && res.data.id) {
                        const newTxId = res.data.id;
                        // Map this transaction ID to all notification IDs that generated it
                        if (tx.notificationIds && Array.isArray(tx.notificationIds)) {
                            tx.notificationIds.forEach((nid: string) => {
                                const existing = notifToTxMap.get(nid) || [];
                                existing.push(newTxId);
                                notifToTxMap.set(nid, existing);
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to create transaction", err);
                    failedCount++;
                }
            }

            // 5. Update History & Remove Pending
            for (const notif of notificationsToProcess) {
                const linkedTxIds = notifToTxMap.get(notif.id) || [];

                await AutomationHistoryService.addLog({
                    notificationText: notif.title + ": " + notif.text,
                    status: failedCount > 0 ? 'PARTIAL' : 'SUCCESS',
                    result: `Batch processed. Created: ${createdCount}, Failed: ${failedCount}`,
                    transactionIds: linkedTxIds,
                    details: { batchSize: notificationsToProcess.length }
                });
            }

            // Let's remove them to clear the queue.
            await NotificationStore.removePending(Array.from(selectedPending));
            setSelectedPending(new Set());

            if (failedCount > 0) {
                showAlert("Batch Complete", `Created ${createdCount} drafts.\nFailed ${failedCount} due to unknown accounts or errors.`);
            } else {
                showAlert("Success", `Created ${createdCount} draft transactions.`);
            }

            loadData();

        } catch (error) {
            console.error("Batch Processing Error", error);
            showAlert("Error", "Failed to process notifications.");
        } finally {
            setIsLoading(false);
        }
    };



    const deletePending = async (id: string) => {
        await NotificationStore.removePending([id]);
        loadData();
    };

    const clearPending = async () => {
        showAlert(
            "Clear Pending",
            "Are you sure you want to clear all pending notifications?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        await NotificationStore.clearPending();
                        loadData();
                    }
                }
            ]
        );
    };

    const clearHistory = async () => {
        showAlert(
            "Clear History",
            "Are you sure you want to clear all automation history?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        await AutomationHistoryService.clearLogs();
                        loadData();
                    }
                }
            ]
        );
    };

    const handleHistoryClick = (log: AutomationLog) => {
        if (log.transactionIds && log.transactionIds.length > 0) {
            // If multiple, maybe show a list? For now, just open the first one.
            // Or if we want to be fancy, show a modal with links.
            // Let's just open the first one for simplicity as requested "view the transaction".
            router.push(`/edit-transaction/${log.transactionIds[0]}`);
        } else {
            showAlert("No Transaction", "This log entry doesn't have a linked transaction.");
        }
    };

    const getLogStatusDisplay = (log: AutomationLog) => {
        if (log.status === 'FAILED') {
            return { text: 'Failed', color: 'text-red-400', bg: 'bg-red-500/20' };
        }

        if (!log.transactionIds || log.transactionIds.length === 0) {
            return { text: 'Processed', color: 'text-gray-400', bg: 'bg-gray-500/20' };
        }

        // Check if any linked transaction is COMPLETED (Recorded)
        const isRecorded = log.transactionIds.some(id => completed?.some(t => t.id === id));
        if (isRecorded) {
            return { text: 'Recorded', color: 'text-green-400', bg: 'bg-green-500/20' };
        }

        // Check if any linked transaction is DRAFT (Draft Created)
        const isDraft = log.transactionIds.some(id => drafts?.some(t => t.id === id));
        if (isDraft) {
            return { text: 'Draft Created', color: 'text-blue-400', bg: 'bg-blue-500/20' };
        }

        // Fallback (maybe deleted?)
        return { text: 'Processed', color: 'text-gray-400', bg: 'bg-gray-500/20' };
    };

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View style={{ paddingTop: insets.top }} className="pb-4 px-4 bg-surface border-b border-outline">
                <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                        <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-onSurface">Automation Hub</Text>
                    <TouchableOpacity onPress={() => router.push('/automation/settings')} className="p-2 -mr-2">
                        <Ionicons name="settings-outline" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View className="flex-row bg-surfaceVariant p-1 rounded-xl">
                    {(['PENDING', 'HISTORY'] as Tab[]).map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-primary-500/20' : ''}`}
                        >
                            <Text className={`font-medium ${activeTab === tab ? 'text-primary-400' : 'text-onSurfaceVariant'}`}>
                                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4"
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} tintColor="#3b82f6" />}
            >
                {activeTab === 'PENDING' && (
                    <View className="py-4 space-y-4">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-onSurfaceVariant text-xs uppercase tracking-wider ml-1">Pending Notifications</Text>
                            {pending.length > 0 && (
                                <TouchableOpacity onPress={clearPending} className="bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/30">
                                    <Text className="text-red-400 text-xs font-bold">Clear All</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {pending.length === 0 ? (
                            <View className="items-center justify-center py-20">
                                <Ionicons name="notifications-off-outline" size={48} color="#4b5563" />
                                <Text className="text-onSurfaceVariant mt-4 text-center">No pending notifications</Text>
                            </View>
                        ) : (
                            pending.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => toggleSelection(item.id)}
                                    className={`p-4 rounded-xl border ${selectedPending.has(item.id) ? 'bg-primary-500/10 border-primary-500/50' : 'bg-surface border-outline'}`}
                                >
                                    <View className="flex-row justify-between items-start">
                                        <View className="flex-1">
                                            <View className="flex-row items-center mb-1">
                                                <Text className="text-primary-400 font-bold text-xs uppercase mr-2">{item.appName}</Text>
                                                <Text className="text-onSurfaceVariant text-xs">{new Date(item.timestamp).toLocaleTimeString()}</Text>
                                            </View>
                                            <Text className="text-onSurface font-medium mb-1">{item.title}</Text>
                                            <Text className="text-onSurfaceVariant text-sm leading-5">{item.text}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => deletePending(item.id)} className="p-2">
                                            <Ionicons name="close" size={16} color="#6b7280" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}

                {activeTab === 'HISTORY' && (
                    <View className="py-4 space-y-3">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-onSurfaceVariant text-xs uppercase tracking-wider ml-1">Recent Activity</Text>
                            {history.length > 0 && (
                                <TouchableOpacity onPress={clearHistory} className="bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/30">
                                    <Text className="text-red-400 text-xs font-bold">Clear History</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {history.length === 0 ? (
                            <View className="items-center justify-center py-20">
                                <Ionicons name="time-outline" size={48} color="#4b5563" />
                                <Text className="text-onSurfaceVariant mt-4 text-center">No history yet</Text>
                            </View>
                        ) : (
                            history.map((log, index) => {
                                const status = getLogStatusDisplay(log);
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        className="bg-surface p-4 rounded-xl border border-outline"
                                        onPress={() => handleHistoryClick(log)}
                                    >
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className={`text-xs font-bold px-2 py-1 rounded-full ${status.bg} ${status.color}`}>
                                                {status.text}
                                            </Text>
                                            <Text className="text-onSurfaceVariant text-xs">{new Date(log.timestamp).toLocaleString()}</Text>
                                        </View>
                                        <Text className="text-onSurface text-sm mb-1" numberOfLines={2}>{log.notificationText}</Text>
                                        <Text className="text-onSurfaceVariant text-xs">{log.result}</Text>
                                        {log.transactionIds && log.transactionIds.length > 0 && (
                                            <View className="mt-2 flex-row items-center">
                                                <Ionicons name="link" size={12} color="#3b82f6" />
                                                <Text className="text-blue-400 text-xs ml-1">View Transaction</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                )}


            </ScrollView>

            {/* Floating Action Button for Processing */}
            {activeTab === 'PENDING' && selectedPending.size > 0 && (
                <View className="absolute bottom-6 left-4 right-4">
                    <TouchableOpacity
                        onPress={handleProcess}
                        className="bg-primary-500 p-4 rounded-2xl flex-row items-center justify-center"
                    >
                        <Ionicons name="sparkles" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text className="text-white font-bold text-lg">
                            Process {selectedPending.size} Notifications
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
