import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEditInvestment, useDeleteInvestment, useGetInvestments } from '../../src/hooks/useQueries';

import { useAlert } from '../../src/context/AlertContext';

export default function EditInvestmentScreen() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const { id } = useLocalSearchParams();
    const investmentId = Number(id);

    const editInvestment = useEditInvestment();
    const deleteInvestment = useDeleteInvestment();
    const { data: investments } = useGetInvestments();

    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [units, setUnits] = useState('');
    const [balance, setBalance] = useState('');
    const [subType, setSubType] = useState('stock');

    const types = ['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'];

    useEffect(() => {
        if (investments && investmentId) {
            const inv = investments.find(i => i.id === investmentId);
            if (inv) {
                setName(inv.name);
                setSymbol(inv.symbol || '');
                setUnits(inv.units?.toString() || '');
                setBalance(inv.balance ? (Number(inv.balance) / 100).toString() : '');
                setSubType(inv.subType || 'stock');
            }
        }
    }, [investments, investmentId]);

    const handleSave = async () => {
        if (!name || !units) return;

        try {
            const unitsVal = parseFloat(units);
            const balanceVal = parseFloat(balance) * 100; // Convert to cents

            await editInvestment.mutateAsync({
                id: investmentId,
                name,
                type: 'ASSET',
                subType,
                symbol: symbol ? symbol.toUpperCase() : undefined,
                units: unitsVal,
                balance: balanceVal.toString(), // Update balance (invested amount)
            });
            router.back();
        } catch (error) {
            console.error(error);
            showAlert("Error", "Failed to update investment");
        }
    };

    const handleDelete = () => {
        showAlert(
            "Delete Investment",
            "Are you sure you want to delete this investment?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteInvestment.mutateAsync(investmentId);
                            router.back();
                        } catch (error) {
                            console.error(error);
                            showAlert("Error", "Failed to delete investment");
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
                <Text className="text-onSurface text-lg font-bold">Edit Investment</Text>
                <TouchableOpacity onPress={handleSave} disabled={editInvestment.isPending}>
                    <Text className={`text-lg font-bold ${editInvestment.isPending ? 'text-gray-500' : 'text-primary-400'}`}>
                        Save
                    </Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView className="flex-1 p-4">
                    <View className="space-y-4">
                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Name</Text>
                            <TextInput
                                className="bg-surface border border-outline rounded-xl px-4 py-4 text-onSurface text-base"
                                placeholder="e.g., Reliance Industries"
                                placeholderTextColor="#6b7280"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Symbol (Optional)</Text>
                            <TextInput
                                className="bg-surface border border-outline rounded-xl px-4 py-4 text-onSurface text-base"
                                placeholder="e.g., RELIANCE.BSE"
                                placeholderTextColor="#6b7280"
                                value={symbol}
                                onChangeText={text => setSymbol(text.toUpperCase())}
                                autoCapitalize="characters"
                            />
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Units</Text>
                            <TextInput
                                className="bg-surface border border-outline rounded-xl px-4 py-4 text-onSurface text-base"
                                placeholder="0"
                                placeholderTextColor="#6b7280"
                                keyboardType="numeric"
                                value={units}
                                onChangeText={setUnits}
                            />
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Total Invested Amount (₹)</Text>
                            <TextInput
                                className="bg-surface border border-outline rounded-xl px-4 py-4 text-onSurface text-base"
                                placeholder="0"
                                placeholderTextColor="#6b7280"
                                keyboardType="numeric"
                                value={balance}
                                onChangeText={setBalance}
                            />
                        </View>

                        <View>
                            <Text className="text-onSurfaceVariant mb-2 ml-1">Type</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                {types.map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => setSubType(t)}
                                        className={`px-4 py-3 rounded-xl border ${subType === t ? 'bg-primary-600 border-primary-500' : 'bg-surface border-outline'}`}
                                    >
                                        <Text className={`font-medium capitalize ${subType === t ? 'text-white' : 'text-onSurfaceVariant'}`}>
                                            {t.replace('-', ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    {/* Delete Button */}
                    <TouchableOpacity
                        className="mt-8 mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl items-center"
                        onPress={handleDelete}
                    >
                        <Text className="text-red-500 font-bold text-lg">Delete Investment</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
