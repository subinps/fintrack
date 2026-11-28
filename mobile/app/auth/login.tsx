import React, { useState, useEffect } from 'react';
// Force rebuild
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/lib/api';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useAlert } from '../../src/context/AlertContext';
import * as SecureStore from '../../src/lib/secureStore';
import { Modal, TouchableWithoutFeedback, Keyboard, Dimensions, BackHandler } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';
import axios from 'axios';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
    const [showSettings, setShowSettings] = useState(false);
    const [customUrl, setCustomUrl] = useState('');
    const { signIn, enterLocalMode } = useAuth();
    const router = useRouter();
    const { showAlert } = useAlert();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const accent = isDark ? '#58B596' : '#1F6E5A';
    const muted = isDark ? '#98A6A0' : '#5A615D';
    const danger = isDark ? '#DE7060' : '#AA3928';
    const [testingConnection, setTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

    useEffect(() => {
        loadCustomUrl();
    }, []);

    useEffect(() => {
        const backAction = () => {
            if (showSettings) {
                setShowSettings(false);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [showSettings]);

    const loadCustomUrl = async () => {
        const savedUrl = await SecureStore.getItemAsync('custom_api_url');
        setCustomUrl(savedUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api');
    };

    const saveCustomUrl = async () => {
        if (!customUrl) {
            await SecureStore.deleteItemAsync('custom_api_url');
        } else {
            await SecureStore.setItemAsync('custom_api_url', customUrl);
        }
        Keyboard.dismiss();
        setShowSettings(false);
        showAlert('Success', 'API URL updated successfully. Please restart the app if you face any issues.');
    };

    const resetToDefault = async () => {
        const defaultUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
        setCustomUrl(defaultUrl);
        setTestResult(null);
        await SecureStore.deleteItemAsync('custom_api_url');
        setShowSettings(false);
        showAlert('Success', 'API URL reset to default.');
    };

    const handleTestConnection = async () => {
        if (!customUrl) {
            showAlert('Error', 'Please enter a URL first.');
            return;
        }
        setTestingConnection(true);
        setTestResult(null);
        try {
            // Simple health check or just a timeout-based ping
            const response = await axios.get(`${customUrl}/health`, { timeout: 5000 });
            if (response.status === 200) {
                setTestResult('success');
            } else {
                setTestResult('error');
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            setTestResult('error');
        } finally {
            setTestingConnection(false);
        }
    };

    // Animation values
    const blob1Opacity = useSharedValue(0.8);
    const blob2Opacity = useSharedValue(0.8);

    useEffect(() => {
        // Start background animations
        blob1Opacity.value = withRepeat(withTiming(0.4, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true);
        blob2Opacity.value = withRepeat(withTiming(0.4, { duration: 4000, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, []);

    const blob1Style = useAnimatedStyle(() => ({ opacity: blob1Opacity.value }));
    const blob2Style = useAnimatedStyle(() => ({ opacity: blob2Opacity.value }));

    const handleResendVerification = async () => {
        if (!email) {
            showAlert('Error', 'Please enter your email address first.');
            return;
        }
        setLoading(true);
        try {
            await api.post('/auth/resend-verification', { email });
            showAlert('Success', 'Verification email sent! Please check your inbox.');
        } catch (error: any) {
            const message = error.response?.data?.error || 'Failed to send email.';
            showAlert('Error', message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        setErrors({});
        const newErrors: typeof errors = {};

        if (!email) {
            newErrors.email = 'Email address is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/login', {
                email,
                password,
            });

            const { accessToken, refreshToken, user } = response.data;
            await signIn(accessToken, refreshToken, user);
        } catch (error: any) {
            console.error('Login error:', error);
            const status = error.response?.status;
            const message = error.response?.data?.error || error.message || 'Connection failed. Check Server URL.';

            if (status === 403 && message.includes('verify')) {
                showAlert(
                    'Email Not Verified',
                    'Please verify your email address to login.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Resend Email', onPress: handleResendVerification }
                    ]
                );
            } else {
                setErrors({ general: message });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <LinearGradient
                colors={isDark ? ['#0D1210', '#131A17', '#0D1210'] : ['#F7F5F0', '#FEFDFB', '#F7F5F0']}
                className="absolute inset-0"
                pointerEvents="none"
            />

            {/* Animated Background Blobs */}
            <Animated.View pointerEvents="none" style={[blob1Style]} className="absolute top-[-100] left-[-100] w-[300] h-[300] bg-primary/15 rounded-full blur-3xl" />
            <Animated.View pointerEvents="none" style={[blob2Style]} className="absolute bottom-[-50] right-[-50] w-[250] h-[250] bg-success/10 rounded-full blur-3xl" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >

                    {/* Logo Section */}
                    <Animated.View entering={FadeInDown.delay(200).springify()} className="items-center mb-12">
                        <View className="w-24 h-24 bg-primary/10 rounded-3xl items-center justify-center mb-6 border border-primary/25">
                            <Ionicons name="wallet-outline" size={48} color={accent} />
                        </View>
                        <Text className="text-5xl font-bold text-onSurface tracking-tight">
                            FinTrack
                        </Text>
                        <Text className="text-onSurfaceVariant mt-3 text-lg font-medium tracking-wide">
                            Track Smart, Grow Fast.
                        </Text>
                    </Animated.View>

                    {/* Login Form */}
                    <Animated.View entering={FadeInUp.delay(400).springify()} className="bg-surface border border-outline rounded-[32px] p-8 space-y-5">

                        {errors.general && (
                            <Animated.View entering={FadeInDown} className="bg-error/10 border border-error/25 p-4 rounded-2xl flex-row items-center">
                                <Ionicons name="alert-circle-outline" size={20} color={danger} />
                                <Text className="text-error ml-2 font-medium flex-1">{errors.general}</Text>
                            </Animated.View>
                        )}
                        <View className="space-y-2">
                            <Text className="text-onSurfaceVariant ml-1 font-medium text-base">Email</Text>
                            <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-2xl px-4 h-14 focus:border-primary">
                                <Ionicons name="mail-outline" size={22} color={muted} />
                                <TextInput
                                    className="flex-1 text-onSurface ml-3 text-base font-medium"
                                    placeholder="name@example.com"
                                    placeholderTextColor={muted}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                            {errors.email && <Text className="text-error text-xs ml-1">{errors.email}</Text>}
                        </View>

                        <View className="space-y-2">
                            <Text className="text-onSurfaceVariant ml-1 font-medium text-base">Password</Text>
                            <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-2xl px-4 h-14 focus:border-primary">
                                <Ionicons name="lock-closed-outline" size={22} color={muted} />
                                <TextInput
                                    className="flex-1 text-onSurface ml-3 text-base font-medium"
                                    placeholder="••••••••"
                                    placeholderTextColor={muted}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={muted} />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text className="text-error text-xs ml-1">{errors.password}</Text>}
                        </View>

                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loading}
                            className="bg-primary h-16 rounded-2xl flex-row items-center justify-center mt-6 active:opacity-80 active:scale-95 transition-transform"
                        >
                            {loading ? (
                                <ActivityIndicator color={isDark ? '#0A1710' : '#FBFAF7'} size="small" />
                            ) : (
                                <Text className="text-primary-foreground font-bold text-xl tracking-wide text-center" style={{ includeFontPadding: false, textAlignVertical: 'center' }}>Sign In</Text>
                            )}
                        </TouchableOpacity>

                        <View className="flex-row justify-between items-center mt-6">
                            <Link href="/auth/forgot-password" asChild>
                                <TouchableOpacity className="py-3">
                                    <Text className="text-onSurfaceVariant font-medium text-base">Forgot Password?</Text>
                                </TouchableOpacity>
                            </Link>

                            <Link href="/auth/register" asChild>
                                <TouchableOpacity className="py-3 px-5 bg-surfaceVariant rounded-xl border border-outline active:opacity-70 items-center justify-center">
                                    <Text className="text-primary font-bold text-base text-center" style={{ includeFontPadding: false, textAlignVertical: 'center' }}>Create Account</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>

                    </Animated.View>

                    {/* Server Settings Button */}
                    <View className="items-center mt-12 mb-6 space-y-4" style={{ zIndex: 50 }}>
                        <TouchableOpacity
                            onPress={() => {
                                console.log('Opening settings...');
                                setShowSettings(true);
                            }}
                            className="flex-row items-center bg-surface px-6 py-3 rounded-2xl border border-outline active:bg-surfaceVariant"
                        >
                            <Ionicons name="server-outline" size={18} color={muted} />
                            <Text className="text-onSurfaceVariant ml-2 font-semibold tracking-wide uppercase text-xs">Server Settings</Text>
                        </TouchableOpacity>

                        <Link href="/auth/local-setup" asChild>
                            <TouchableOpacity
                                className="flex-row items-center bg-primary/10 px-6 py-3 rounded-2xl border border-primary/25 active:bg-primary/20"
                            >
                                <Ionicons name="phone-portrait-outline" size={18} color={accent} />
                                <Text className="text-primary ml-2 font-semibold tracking-wide uppercase text-xs">Continue in Local Mode</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* API Settings Overlay (Fake Modal) */}
            {showSettings && (
                <View style={[styles.overlayContainer, { zIndex: 9999 }]}>
                    <TouchableWithoutFeedback onPress={() => setShowSettings(false)}>
                        <View style={styles.overlayBackdrop} />
                    </TouchableWithoutFeedback>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.overlayContentWrapper}
                    >
                        <View style={styles.overlayContent}>
                            <View className="items-center mb-6">
                                <Ionicons name="server" size={40} color={accent} style={{ marginBottom: 16 }} />
                                <Text className="text-2xl font-bold text-onSurface text-center">Server Settings</Text>
                                <Text className="text-onSurfaceVariant text-center mt-2 text-sm">
                                    Configure your custom backend URL.
                                </Text>
                            </View>

                            <View className="space-y-4 mb-6">
                                <View>
                                    <Text className="text-onSurfaceVariant text-xs font-bold uppercase tracking-wider mb-2 ml-1">API URL</Text>
                                    <TextInput
                                        style={styles.overlayInput}
                                        value={customUrl}
                                        onChangeText={setCustomUrl}
                                        placeholder="https://your-api.com/api"
                                        placeholderTextColor={muted}
                                        autoCapitalize="none"
                                        keyboardType="url"
                                    />
                                </View>

                                <View className="flex-row justify-end space-x-4">
                                    <TouchableOpacity onPress={resetToDefault} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                        <Text className="text-primary font-semibold">Reset Default</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="flex-row space-x-3">
                                <TouchableOpacity
                                    onPress={() => setShowSettings(false)}
                                    className="flex-1 py-4 rounded-xl border border-outline items-center active:opacity-70"
                                >
                                    <Text className="text-onSurfaceVariant font-bold">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={saveCustomUrl}
                                    className="flex-1 py-4 rounded-xl bg-primary items-center active:opacity-80"
                                >
                                    <Text className="text-primary-foreground font-bold">Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            )}
        </View>
    );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 100,
    },
    overlayBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.9)',
    },
    overlayContentWrapper: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    overlayContent: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#131A17',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#2A3430',
        padding: 24,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    overlayInput: {
        backgroundColor: '#1A221E',
        color: '#E7EEF3',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#2A3430',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    modalContainer: {
        width: Math.min(width * 0.9, 440),
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 32,
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 10,
        letterSpacing: -0.5,
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    inputGroup: {
        marginBottom: 32,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    badgeSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    badgeTextSuccess: {
        color: '#10b981',
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 4,
    },
    badgeError: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    badgeTextError: {
        color: '#ef4444',
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(2, 6, 23, 0.6)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        height: 64,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    inputWrapperSuccess: {
        borderColor: 'rgba(16, 185, 129, 0.3)',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    inputWrapperError: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
    textInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    ghostButton: {
        paddingVertical: 8,
    },
    ghostButtonText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    testButtonText: {
        color: '#60a5fa',
        fontSize: 13,
        fontWeight: '700',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 16,
    },
    cancelButton: {
        flex: 1,
        height: 64,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    cancelButtonText: {
        color: '#94a3b8',
        fontSize: 17,
        fontWeight: '700',
    },
    saveButton: {
        flex: 1,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});
