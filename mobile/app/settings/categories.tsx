import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGetCategories, useAddCategory, useDeleteCategory } from '../../src/hooks/useQueries';
import { LinearGradient } from 'expo-linear-gradient';

const CATEGORY_TYPES = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'];

export default function CategoriesScreen() {
    const router = useRouter();
    const { data: categories, isLoading } = useGetCategories();
    const addCategory = useAddCategory();
    const deleteCategory = useDeleteCategory();

    const [selectedType, setSelectedType] = useState('ASSET');
    const [newCategory, setNewCategory] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const filteredCategories = categories?.filter(c => c.type === selectedType) || [];

    const handleAdd = async () => {
        if (!newCategory.trim()) return;
        try {
            await addCategory.mutateAsync({ name: newCategory, type: selectedType });
            setNewCategory('');
            setIsAdding(false);
        } catch (error) {
            console.error('Failed to add category', error);
        }
    };

    const handleDelete = (id: number) => {
        deleteCategory.mutate(id);
    };

    return (
        <View className="flex-1 bg-background">
            <View className="pt-12 pb-4 px-4 border-b border-outline bg-surface">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                        <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-onSurface">Categories</Text>
                    <TouchableOpacity onPress={() => setIsAdding(!isAdding)} className="p-2 -mr-2">
                        <Ionicons name="add" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                </View>

                {/* Type Selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
                    {CATEGORY_TYPES.map(type => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setSelectedType(type)}
                            className={`mr-3 px-4 py-2 rounded-full border ${selectedType === type ? 'bg-primary-600 border-primary-500' : 'bg-surface border-outline'}`}
                        >
                            <Text className={`font-medium ${selectedType === type ? 'text-white' : 'text-onSurfaceVariant'}`}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Add New Input */}
            {isAdding && (
                <View className="p-4 bg-surface border-b border-outline">
                    <View className="flex-row gap-2">
                        <TextInput
                            className="flex-1 bg-surface border border-outline rounded-xl px-4 py-3 text-onSurface"
                            placeholder={`New ${selectedType.toLowerCase()} category...`}
                            placeholderTextColor="#6b7280"
                            value={newCategory}
                            onChangeText={setNewCategory}
                            autoFocus
                        />
                        <TouchableOpacity
                            onPress={handleAdd}
                            disabled={addCategory.isPending}
                            className="bg-primary-600 px-4 justify-center rounded-xl"
                        >
                            {addCategory.isPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Ionicons name="checkmark" size={24} color="white" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ScrollView className="flex-1 p-4">
                {isLoading ? (
                    <ActivityIndicator size="large" color="#3b82f6" className="mt-8" />
                ) : (
                    <View className="space-y-2">
                        {filteredCategories.length === 0 ? (
                            <Text className="text-onSurfaceVariant text-center mt-8">No categories found for {selectedType}</Text>
                        ) : (
                            filteredCategories.map(category => (
                                <View key={category.id} className="flex-row items-center justify-between p-4 bg-surface border border-outline rounded-xl">
                                    <Text className="text-onSurface font-medium">{category.name}</Text>
                                    <TouchableOpacity
                                        onPress={() => handleDelete(category.id)}
                                        className="p-2 -mr-2"
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
