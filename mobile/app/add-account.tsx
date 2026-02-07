import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAddAccount, useGetCategories } from '../src/hooks/useQueries';
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

export default function AddAccountScreen() {
    const router = useRouter();
    const { name: initialName } = useLocalSearchParams();
    const addAccount = useAddAccount();
    const { data: dynamicCategories, isLoading: isLoadingCategories } = useGetCategories();

    const [name, setName] = useState(initialName ? String(initialName) : '');
    const [balance, setBalance] = useState('');
    const [type, setType] = useState<string>('ASSET');
    const [subType, setSubType] = useState('');
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState('');

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
            await addAccount.mutateAsync({
                name,
                type,
                subType,
                openingBalance: (parseFloat(balance || '0') * 100).toString(), // Cents
            });
            router.back();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View className="flex-1 bg-background">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-outline mt-8">
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-primary-400 text-lg">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-onSurface text-lg font-bold">New Account</Text>
                <TouchableOpacity onPress={handleSave} disabled={addAccount.isPending}>
                    <Text className={`text-lg font-bold ${addAccount.isPending ? 'text-gray-500' : 'text-primary-400'}`}>
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
                                autoFocus
                            />
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Opening Balance</Text>
                            <TextInput
                                className="bg-surface border border-outline rounded-xl px-4 py-4 text-onSurface text-base"
                                placeholder="0.00"
                                placeholderTextColor="#6b7280"
                                keyboardType="numeric"
                                value={balance}
                                onChangeText={setBalance}
                            />
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
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
