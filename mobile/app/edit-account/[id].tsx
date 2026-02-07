import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEditAccount, useDeleteAccount, useGetAccounts, useGetCategories } from '../../src/hooks/useQueries';
import { Ionicons } from '@expo/vector-icons';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

const DEFAULT_CATEGORIES: Record<string, string[]> = {
    'ASSET': [
        'Savings', 'Current', 'Wallet', 'Cash',
        'Stock', 'Mutual Fund', 'Crypto', 'ETF', 'Bond', 'Other Investment',
        'Receivable', 'Property', 'Vehicle', 'Gold', 'Other Asset'
    ],
    'LIABILITY': [
        'Credit Card', 'Loan', 'Mortgage', 'Payable', 'Overdraft', 'Other Liability'
    ],
    'INCOME': [
        'Salary', 'Freelance', 'Business', 'Dividend', 'Interest', 'Rental', 'Refund', 'Gift', 'Bonus', 'Grant', 'Other Income'
    ],
    'EXPENSE': [
        'Food', 'Groceries', 'Rent', 'Utilities', 'Transportation', 'Entertainment', 'Health', 'Shopping', 'Travel',
        'Education', 'Insurance', 'Tax', 'Donation', 'Subscriptions', 'Personal Care', 'Home', 'Kids', 'Pets', 'Other Expense'
    ],
    'EQUITY': ['Opening Balance', 'Capital', 'Retained Earnings'],
};

import { useAlert } from '../../src/context/AlertContext';

export default function EditAccountScreen() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const { id } = useLocalSearchParams();
    const accountId = Number(id);

    const editAccount = useEditAccount();
    const deleteAccount = useDeleteAccount();
    const { data: accounts } = useGetAccounts();
    const { data: dynamicCategories } = useGetCategories();

    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');
    const [type, setType] = useState<string>('ASSET');
    const [subType, setSubType] = useState('');

    // Modal State
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState('');

    useEffect(() => {
        if (accounts && accountId) {
            const acc = accounts.find(a => a.id === accountId);
            if (acc) {
                setName(acc.name);
                setBalance((Number(acc.balance) / 100).toString());
                setType(acc.type);
                setSubType(acc.subType || '');
            }
        }
    }, [accounts, accountId]);

    // Merge default and dynamic categories
    const availableCategories = useMemo(() => {
        const defaults = DEFAULT_CATEGORIES[type] || [];
        const dynamic = dynamicCategories
            ?.filter(c => c.type === type)
            .map(c => c.name) || [];

        // Combine and deduplicate
        return Array.from(new Set([...defaults, ...dynamic])).sort();
    }, [type, dynamicCategories]);

    const handleSave = async () => {
        if (!name) return;

        try {
            await editAccount.mutateAsync({
                id: accountId,
                name,
                type,
                subType,
            });
            router.back();
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to update account");
        }
    };

    const handleDelete = () => {
        showAlert(
            "Delete Account",
            "Are you sure you want to delete this account? This will delete all associated transactions.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteAccount.mutateAsync(accountId);
                            router.back();
                        } catch (error) {
                            console.error(error);
                            showAlert("Error", "Failed to delete account");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View className="flex-1 bg-background">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-outline mt-8">
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-primary-400 text-lg">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-onSurface text-lg font-bold">Edit Account</Text>
                <TouchableOpacity onPress={handleSave} disabled={editAccount.isPending}>
                    <Text className={`text-lg font-bold ${editAccount.isPending ? 'text-gray-500' : 'text-primary-400'}`}>
                        Save
                    </Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView className="flex-1 p-4">
                    <View className="space-y-4">
                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Account Name</Text>
                            <TextInput
                                className="bg-surface border border-outline rounded-xl px-4 py-4 text-onSurface text-base"
                                placeholder="e.g., HDFC Savings"
                                placeholderTextColor="#6b7280"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Current Balance (Read Only)</Text>
                            <View className="bg-surfaceVariant border border-outline rounded-xl px-4 py-4">
                                <Text className="text-onSurfaceVariant text-base">₹{balance}</Text>
                            </View>
                            <Text className="text-onSurfaceVariant text-xs mt-1 ml-1">To adjust balance, add a transaction.</Text>
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Type</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pb-2">
                                {ACCOUNT_TYPES.map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => { setType(t); setSubType(''); }}
                                        className={`px-4 py-2 rounded-full border ${type === t ? 'bg-primary-600 border-primary-500' : 'bg-surface border-outline'}`}
                                    >
                                        <Text className={`font-medium text-sm ${type === t ? 'text-white' : 'text-onSurfaceVariant'}`}>
                                            {t}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Category</Text>
                            <TouchableOpacity
                                onPress={() => setCategoryModalVisible(true)}
                                className="bg-surface border border-outline rounded-xl px-4 py-4 flex-row justify-between items-center"
                            >
                                <Text className={subType ? "text-onSurface text-base" : "text-onSurfaceVariant text-base"}>
                                    {subType || "Select Category"}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        {/* Category Modal */}
                        <Modal
                            visible={categoryModalVisible}
                            animationType="slide"
                            transparent={true}
                            onRequestClose={() => setCategoryModalVisible(false)}
                        >
                            <View className="flex-1 bg-black/80 justify-end">
                                <View className="bg-surface h-[70%] rounded-t-3xl border-t border-outline overflow-hidden">
                                    <View className="flex-row justify-between items-center p-4 border-b border-outline">
                                        <Text className="text-xl font-bold text-onSurface">Select Category</Text>
                                        <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                                            <Ionicons name="close" size={24} color="#9ca3af" />
                                        </TouchableOpacity>
                                    </View>

                                    <View className="p-4 border-b border-outline">
                                        <View className="flex-row gap-2">
                                            <TextInput
                                                className="flex-1 bg-background border border-outline rounded-xl px-4 py-3 text-onSurface"
                                                placeholder="Add new category..."
                                                placeholderTextColor="#6b7280"
                                                value={newCategoryInput}
                                                onChangeText={setNewCategoryInput}
                                            />
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (newCategoryInput.trim()) {
                                                        setSubType(newCategoryInput.trim());
                                                        setNewCategoryInput('');
                                                        setCategoryModalVisible(false);
                                                    }
                                                }}
                                                className="bg-primary-600 px-4 justify-center rounded-xl"
                                            >
                                                <Ionicons name="add" size={24} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <ScrollView className="flex-1 p-4">
                                        {availableCategories.map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => {
                                                    setSubType(cat);
                                                    setCategoryModalVisible(false);
                                                }}
                                                className={`p-4 border-b border-outline flex-row justify-between items-center ${subType === cat ? 'bg-primary-500/10' : ''}`}
                                            >
                                                <Text className={`text-base ${subType === cat ? 'text-primary-400 font-bold' : 'text-onSurface'}`}>
                                                    {cat}
                                                </Text>
                                                {subType === cat && <Ionicons name="checkmark" size={20} color="#60a5fa" />}
                                            </TouchableOpacity>
                                        ))}
                                        <View className="h-8" />
                                    </ScrollView>
                                </View>
                            </View>
                        </Modal>
                    </View>

                    <TouchableOpacity
                        className="mt-8 mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl items-center"
                        onPress={handleDelete}
                    >
                        <Text className="text-red-500 font-bold text-lg">Delete Account</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
