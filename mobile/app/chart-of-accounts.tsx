import { View, Text, SectionList, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Platform, UIManager } from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGetAccounts, useDeleteAccount } from '../src/hooks/useQueries';
import { Account } from '../src/hooks/useQueries';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

import { useAlert } from '../src/context/AlertContext';

export default function ChartOfAccountsScreen() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const { initialSearch } = useLocalSearchParams();
    const { data: accounts, isLoading } = useGetAccounts();
    const deleteAccount = useDeleteAccount();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(initialSearch && ACCOUNT_TYPES.includes(String(initialSearch)) ? String(initialSearch) : 'ASSET');

    const sections = useMemo(() => {
        if (!accounts) return [];

        let filteredAccounts = accounts;

        // Filter by Tab
        if (activeTab === 'ASSET') {
            filteredAccounts = accounts.filter(a => a.type === 'ASSET');
        } else {
            filteredAccounts = accounts.filter(a => a.type === activeTab);
        }

        // Filter by Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredAccounts = filteredAccounts.filter(a =>
                a.name.toLowerCase().includes(query) ||
                (a.subType && a.subType.toLowerCase().includes(query))
            );
        }

        // Group by subType
        const groups: Record<string, Account[]> = {};
        filteredAccounts.forEach(acc => {
            const subType = acc.subType ? acc.subType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other';
            if (!groups[subType]) groups[subType] = [];
            groups[subType].push(acc);
        });

        // Convert to SectionList format
        return Object.keys(groups).sort().map(category => ({
            title: category,
            data: groups[category],
            total: groups[category].reduce((sum, acc) => sum + Number(acc.balance), 0)
        }));

    }, [accounts, activeTab, searchQuery]);

    const handleDelete = (id: number) => {
        showAlert(
            "Delete Account",
            "Are you sure you want to delete this account? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteAccount.mutateAsync(id);
                        } catch (error) {
                            showAlert("Error", "Failed to delete account. It may have associated transactions.");
                        }
                    }
                }
            ]
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value / 100);
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-outline mt-8">
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                    <Text className="text-onSurface text-lg font-bold ml-2">Chart of Accounts</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/add-account')}>
                    <Ionicons name="add" size={24} color="#3b82f6" />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View className="px-4 pt-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pb-4">
                    {ACCOUNT_TYPES.map(type => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setActiveTab(type)}
                            className={`px-4 py-2 rounded-full border ${activeTab === type ? 'bg-primary-600 border-primary-500' : 'bg-surface border-outline'}`}
                        >
                            <Text className={`font-medium text-sm ${activeTab === type ? 'text-white' : 'text-onSurfaceVariant'}`}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Search */}
            <View className="px-4 pb-4">
                <View className="bg-surface rounded-xl flex-row items-center px-4 border border-outline">
                    <Ionicons name="search" size={20} color="#9ca3af" />
                    <TextInput
                        className="flex-1 p-3 text-onSurface"
                        placeholder={`Search ${activeTab.toLowerCase()} accounts...`}
                        placeholderTextColor="#6b7280"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* Content */}
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        className="flex-row justify-between items-center p-4 bg-surface border-b border-outline mx-4 mb-2 rounded-lg"
                        onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: item.id } })}
                    >
                        <View className="flex-row items-center gap-3 flex-1 mr-4">
                            <View className={`w-10 h-10 rounded-full items-center justify-center flex-shrink-0 ${item.type === 'ASSET' ? 'bg-emerald-500/10' :
                                item.type === 'LIABILITY' ? 'bg-red-500/10' :
                                    item.type === 'INCOME' ? 'bg-blue-500/10' :
                                        'bg-gray-500/10'
                                }`}>
                                <Ionicons
                                    name={
                                        item.type === 'ASSET' ? 'wallet-outline' :
                                            item.type === 'LIABILITY' ? 'trending-down-outline' :
                                                item.type === 'INCOME' ? 'trending-up-outline' :
                                                    'list-outline'
                                    }
                                    size={20}
                                    color={
                                        item.type === 'ASSET' ? '#34d399' :
                                            item.type === 'LIABILITY' ? '#f87171' :
                                                item.type === 'INCOME' ? '#60a5fa' :
                                                    '#9ca3af'
                                    }
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-onSurface font-medium text-base" numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                                <Text className="text-onSurfaceVariant text-xs capitalize">{item.subType || item.type}</Text>
                            </View>
                        </View>
                        <View className="items-end flex-shrink-0">
                            <Text className={`font-bold text-base ${item.type === 'LIABILITY' || item.type === 'EXPENSE' ? 'text-red-400' : 'text-emerald-400'
                                }`}>
                                {formatCurrency(Number(item.balance))}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
                renderSectionHeader={({ section: { title, total } }) => (
                    <View className="flex-row justify-between items-center px-4 py-2 bg-background/95 backdrop-blur-md mt-2">
                        <Text className="text-onSurfaceVariant font-bold uppercase text-xs tracking-wider">{title}</Text>
                        <Text className={`font-bold text-xs ${activeTab === 'LIABILITY' || activeTab === 'EXPENSE' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {formatCurrency(total)}
                        </Text>
                    </View>
                )}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <Text className="text-onSurfaceVariant">No accounts found</Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 100 }}
                stickySectionHeadersEnabled={true}
            />
        </View>
    );
}
