import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, ScrollView, Dimensions } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Account } from '../../src/hooks/useQueries';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

interface AccountSelectorProps {
    accounts: Account[] | undefined;
    selectedAccountId: number | null;
    onSelect: (accountId: number) => void;
    label?: string;
    placeholder?: string;
}

const ACCOUNT_TYPES = ['RECENT', 'ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'];
const RECENT_ACCOUNTS_KEY = 'recent_accounts_ids';

export default function AccountSelector({ accounts, selectedAccountId, onSelect, label, placeholder = "Select Account" }: AccountSelectorProps) {
    const router = useRouter();
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<string>('RECENT');
    const [recentAccountIds, setRecentAccountIds] = useState<number[]>([]);

    const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

    // Load recent accounts on mount
    useEffect(() => {
        loadRecentAccounts();
    }, []);

    const loadRecentAccounts = async () => {
        try {
            const jsonValue = await SecureStore.getItemAsync(RECENT_ACCOUNTS_KEY);
            if (jsonValue != null) {
                setRecentAccountIds(JSON.parse(jsonValue));
            }
        } catch (e) {
            console.error("Failed to load recent accounts", e);
        }
    };

    const saveRecentAccount = async (id: number) => {
        try {
            let newRecents = [id, ...recentAccountIds.filter(rid => rid !== id)];
            newRecents = newRecents.slice(0, 10); // Keep top 10
            setRecentAccountIds(newRecents);
            await SecureStore.setItemAsync(RECENT_ACCOUNTS_KEY, JSON.stringify(newRecents));
        } catch (e) {
            console.error("Failed to save recent account", e);
        }
    };

    const handleSelect = (id: number) => {
        saveRecentAccount(id);
        onSelect(id);
        setModalVisible(false);
        setSearchQuery('');
    };

    // Update active tab when opening modal if an account is selected
    const handleOpenModal = () => {
        if (selectedAccount) {
            setActiveTab(selectedAccount.type);
        } else {
            setActiveTab('RECENT');
        }
        setModalVisible(true);
    };

    const filteredAccounts = useMemo(() => {
        if (!accounts) return [];

        let filtered = accounts;

        // Filter by Tab (Type) unless searching
        if (!searchQuery) {
            if (activeTab === 'RECENT') {
                // Filter accounts that are in the recent list, preserving order
                filtered = recentAccountIds
                    .map(id => accounts.find(a => a.id === id))
                    .filter((a): a is Account => a !== undefined);
            } else {
                filtered = filtered.filter(a => a.type === activeTab);
            }
        } else {
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.subType && a.subType.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        return filtered;
    }, [accounts, searchQuery, activeTab, recentAccountIds]);

    const groupedAccounts = useMemo(() => {
        // If RECENT tab is active and not searching, don't group by category, just show as "Recently Used"
        if (activeTab === 'RECENT' && !searchQuery) {
            return { 'Recently Used': filteredAccounts };
        }

        const groups: { [key: string]: Account[] } = {};
        filteredAccounts.forEach(acc => {
            const category = acc.subType
                ? acc.subType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
                : (acc.type === 'ASSET' ? 'Other Assets' : 'Other Liabilities');

            if (!groups[category]) groups[category] = [];
            groups[category].push(acc);
        });

        // Sort keys alphabetically
        return Object.keys(groups).sort().reduce((obj, key) => {
            obj[key] = groups[key];
            return obj;
        }, {} as { [key: string]: Account[] });
    }, [filteredAccounts, activeTab, searchQuery]);

    const renderAccountCard = (item: Account) => (
        <TouchableOpacity
            key={item.id}
            className={`w-[48%] p-3 mb-3 rounded-xl border ${selectedAccountId === item.id
                ? 'bg-primary-500/20 border-primary-500/50'
                : 'bg-card/30 border-white/5'
                }`}
            onPress={() => handleSelect(item.id)}
        >
            <View className="flex-row items-center gap-2 mb-2">
                <View className={`w-8 h-8 rounded-full items-center justify-center ${item.type === 'ASSET' ? 'bg-emerald-500/10' :
                    item.type === 'LIABILITY' ? 'bg-red-500/10' : 'bg-blue-500/10'
                    }`}>
                    <Ionicons
                        name={
                            item.type === 'ASSET' ? 'wallet-outline' :
                                item.type === 'LIABILITY' ? 'card-outline' : 'cash-outline'
                        }
                        size={16}
                        color={
                            item.type === 'ASSET' ? '#10b981' :
                                item.type === 'LIABILITY' ? '#ef4444' : '#3b82f6'
                        }
                    />
                </View>
                <Text className="text-gray-400 text-[10px] uppercase font-bold flex-1" numberOfLines={1}>
                    {item.subType || item.type}
                </Text>
            </View>
            <Text className={`font-bold text-sm mb-1 ${selectedAccountId === item.id ? 'text-white' : 'text-gray-200'}`} numberOfLines={2}>
                {item.name}
            </Text>
            <Text className="text-gray-500 text-xs">
                {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 0,
                }).format(Number(item.balance) / 100)}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View>
            {label && <Text className="text-gray-400 mb-2 ml-1">{label}</Text>}
            <TouchableOpacity
                className="bg-card/50 border border-white/10 rounded-xl px-4 py-4 flex-row justify-between items-center"
                onPress={handleOpenModal}
            >
                <Text className={selectedAccount ? 'text-white font-medium' : 'text-gray-500'}>
                    {selectedAccount ? selectedAccount.name : (selectedAccountId ? "Unknown Account (Tap to Select)" : placeholder)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 bg-background">
                    {/* Header */}
                    <View className="p-4 border-b border-white/10 flex-row items-center gap-3">
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                        <View className="flex-1 bg-card/50 rounded-xl flex-row items-center px-3 border border-white/10">
                            <Ionicons name="search" size={20} color="#9ca3af" />
                            <TextInput
                                className="flex-1 p-3 text-white"
                                placeholder="Search accounts..."
                                placeholderTextColor="#6b7280"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    {/* Type Tabs (Only show if not searching) */}
                    {!searchQuery && (
                        <View className="px-4 py-4">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                {ACCOUNT_TYPES.map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        onPress={() => setActiveTab(type)}
                                        className={`px-6 py-3 rounded-xl border ${activeTab === type
                                            ? 'bg-primary-600 border-primary-500'
                                            : 'bg-card/50 border-white/10'
                                            }`}
                                    >
                                        <Text className={`font-bold ${activeTab === type ? 'text-white' : 'text-gray-400'}`}>
                                            {type === 'RECENT' ? 'Recent' : type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Content */}
                    <FlatList
                        data={Object.keys(groupedAccounts)}
                        keyExtractor={item => item}
                        renderItem={({ item: category }) => (
                            <View className="mb-4 px-4">
                                <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 ml-1">
                                    {category}
                                </Text>
                                <View className="flex-row flex-wrap justify-between">
                                    {groupedAccounts[category].map(acc => renderAccountCard(acc))}
                                </View>
                            </View>
                        )}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20">
                                <Text className="text-gray-500">
                                    {activeTab === 'RECENT' ? 'No recent accounts' : 'No accounts found'}
                                </Text>
                                {searchQuery && (
                                    <TouchableOpacity
                                        className="mt-4 p-3 bg-primary-500/20 border border-primary-500/50 rounded-xl flex-row items-center"
                                        onPress={() => {
                                            setModalVisible(false);
                                            router.push({ pathname: '/add-account', params: { name: searchQuery } });
                                        }}
                                    >
                                        <Ionicons name="add-circle-outline" size={20} color="#3b82f6" style={{ marginRight: 8 }} />
                                        <Text className="text-primary-400 font-bold">Create "{searchQuery}"</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                    />
                </View>
            </Modal>
        </View>
    );
}
