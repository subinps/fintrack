import React from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type AlertButton = {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

type CustomAlertProps = {
    visible: boolean;
    title: string;
    message: string;
    buttons?: AlertButton[];
    onClose: () => void;
};

export default function CustomAlert({ visible, title, message, buttons, onClose }: CustomAlertProps) {
    const [animation] = React.useState(new Animated.Value(0));

    React.useEffect(() => {
        Animated.spring(animation, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: 60,
            friction: 7,
        }).start();
    }, [visible]);

    if (!visible) return null;

    const handleButtonPress = (btn: AlertButton) => {
        onClose();
        if (btn.onPress) {
            // Small delay to allow animation to start closing or just close immediately
            btn.onPress();
        }
    };

    return (
        <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 99999, elevation: 99999 }} pointerEvents="auto">
            <View className="flex-1 justify-center items-center px-6">
                <View className="absolute inset-0 bg-black/80" />

                <Animated.View
                    style={{
                        transform: [{ scale: animation }],
                        opacity: animation,
                        width: Math.min(width - 48, 340),
                    }}
                    className="overflow-hidden rounded-[32px] bg-surface border border-outline"
                >
                    {/* Header / Icon */}
                    <View className="items-center pt-8 pb-4">
                        {title.toLowerCase().includes('error') || title.toLowerCase().includes('delete') ? (
                            <View className="w-16 h-16 rounded-full bg-red-500/10 items-center justify-center mb-4">
                                <Ionicons name="alert-circle" size={32} color="#ef4444" />
                            </View>
                        ) : title.toLowerCase().includes('success') ? (
                            <View className="w-16 h-16 rounded-full bg-emerald-500/10 items-center justify-center mb-4">
                                <Ionicons name="checkmark-circle" size={32} color="#10b981" />
                            </View>
                        ) : (
                            <View className="w-16 h-16 rounded-full bg-primary-500/10 items-center justify-center mb-4">
                                <Ionicons name="information-circle" size={32} color="#8b5cf6" />
                            </View>
                        )}

                        <Text className="text-onSurface text-xl font-bold text-center px-6">{title}</Text>
                    </View>

                    {/* Content */}
                    <View className="px-8 pb-8">
                        <Text className="text-onSurfaceVariant text-center text-base leading-6">{message}</Text>
                    </View>

                    {/* Buttons */}
                    <View className="flex-row border-t border-outline">
                        {buttons?.map((btn, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => handleButtonPress(btn)}
                                className={`flex-1 py-5 items-center justify-center ${index > 0 ? 'border-l border-outline' : ''
                                    } active:bg-surfaceVariant`}
                            >
                                <Text
                                    className={`font-bold text-base ${btn.style === 'destructive'
                                        ? 'text-red-500'
                                        : btn.style === 'cancel'
                                            ? 'text-onSurfaceVariant'
                                            : 'text-primary-500'
                                        }`}
                                >
                                    {btn.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            </View>
        </View>
    );
}
