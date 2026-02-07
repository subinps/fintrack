import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAddInvestment } from '../src/hooks/useQueries';

export default function AddInvestmentScreen() {
    const router = useRouter();
    const addInvestment = useAddInvestment();

    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [units, setUnits] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [subType, setSubType] = useState('stock');

    const types = ['stock', 'mutual-fund', 'crypto', 'bond', 'etf', 'other-investment'];

    const handleSave = async () => {
        if (!name || !units || !purchasePrice) return;

        try {
            const unitsVal = parseFloat(units);
            const priceVal = parseFloat(purchasePrice);
            const openingBalance = (unitsVal * priceVal * 100).toString(); // Cents

            await addInvestment.mutateAsync({
                name,
                type: 'ASSET',
                subType,
                symbol: symbol ? symbol.toUpperCase() : undefined,
                units: unitsVal,
                openingBalance,
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
                <Text className="text-onSurface text-lg font-bold">New Investment</Text>
                <TouchableOpacity onPress={handleSave} disabled={addInvestment.isPending}>
                    <Text className={`text-lg font-bold ${addInvestment.isPending ? 'text-gray-500' : 'text-primary-400'}`}>
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
                                autoFocus
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

                        <View className="flex-row gap-4">
                            <View className="flex-1">
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
                            <View className="flex-1">
                                <Text className="text-onSurfaceVariant mb-2 ml-1">Buy Price (₹)</Text>
                                <TextInput
                                    className="bg-surface border border-outline rounded-xl px-4 py-4 text-onSurface text-base"
                                    placeholder="0.00"
                                    placeholderTextColor="#6b7280"
                                    keyboardType="numeric"
                                    value={purchasePrice}
                                    onChangeText={setPurchasePrice}
                                />
                            </View>
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
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
