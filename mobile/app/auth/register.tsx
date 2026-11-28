import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, DimensionValue, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useAlert } from '../../src/context/AlertContext';

export default function Register() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const accent = isDark ? '#58B596' : '#1F6E5A';
    const muted = isDark ? '#98A6A0' : '#5A615D';
    const danger = isDark ? '#DE7060' : '#AA3928';
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [resending, setResending] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; general?: string }>({});
    const { signIn } = useAuth();
    const router = useRouter();
    const { showAlert } = useAlert();

    const getPasswordStrength = () => {
        if (password.length === 0) return { label: '', color: 'bg-outline', width: '0%' as DimensionValue };
        if (password.length < 6) return { label: 'Weak', color: 'bg-error', width: '25%' as DimensionValue };

        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length >= 10 && hasNumber && hasSpecial) return { label: 'Strong', color: 'bg-success', width: '100%' as DimensionValue };
        if (password.length >= 8 && hasNumber) return { label: 'Good', color: 'bg-primary', width: '75%' as DimensionValue };
        return { label: 'Fair', color: 'bg-warning', width: '50%' as DimensionValue };
    };

    const strength = getPasswordStrength();

    const handleSignUp = async () => {
        setErrors({});
        const newErrors: typeof errors = {};

        if (!name) newErrors.name = 'Full name is required';
        if (!email) {
            newErrors.email = 'Email address is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }
        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        if (!agreed) {
            setErrors({ general: 'Please agree to the terms and conditions to continue.' });
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/register', {
                name,
                email,
                password,
            });

            if (response.status === 201 || response.status === 200) {
                setSuccess(true);
            }
        } catch (error: any) {
            console.error('Sign Up error:', error);
            setErrors({ general: error.response?.data?.error || 'Could not create account' });
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setResending(true);
        try {
            await api.post('/auth/resend-verification', { email });
            showAlert('Success', 'Verification email resent successfully!');
        } catch (error: any) {
            showAlert('Error', error.response?.data?.error || 'Failed to resend verification email');
        } finally {
            setResending(false);
        }
    };

    const handleOpenTerms = () => {
        Linking.openURL('https://fintrack.com/terms');
    };

    const handleOpenPrivacy = () => {
        Linking.openURL('https://fintrack.com/privacy');
    };

    if (success) {
        return (
            <View className="flex-1 bg-background justify-center items-center p-6">
                <LinearGradient
                    colors={isDark ? ['#0D1210', '#131A17', '#0D1210'] : ['#F7F5F0', '#FEFDFB', '#F7F5F0']}
                    className="absolute inset-0"
                />
                <Animated.View entering={FadeInUp.springify()} className="bg-surface border border-outline rounded-[40px] p-10 items-center space-y-8 w-full max-w-sm">
                    <View className="w-24 h-24 bg-success/10 rounded-full items-center justify-center mb-2 border border-success/25">
                        <Ionicons name="mail-open" size={48} color={accent} />
                    </View>

                    <View className="items-center space-y-2">
                        <Text className="text-3xl font-bold text-onSurface text-center">Verify Email</Text>
                        <Text className="text-onSurfaceVariant text-center text-base leading-6 px-2">
                            We've sent a link to <Text className="text-primary font-semibold">{email}</Text>. Please check your inbox to activate your account.
                        </Text>
                    </View>

                    <View className="w-full space-y-4 pt-4">
                        <TouchableOpacity
                            onPress={() => router.replace('/auth/login')}
                            className="bg-primary h-16 rounded-2xl items-center justify-center w-full active:opacity-80"
                        >
                            <Text className="text-primary-foreground font-bold text-lg">Back to Login</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleResendVerification}
                            disabled={resending}
                            className="h-14 rounded-2xl items-center justify-center w-full border border-outline active:bg-surfaceVariant"
                        >
                            {resending ? (
                                <ActivityIndicator color={muted} />
                            ) : (
                                <Text className="text-onSurface font-semibold">Resend Email</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <LinearGradient
                colors={isDark ? ['#0D1210', '#131A17', '#0D1210'] : ['#F7F5F0', '#FEFDFB', '#F7F5F0']}
                className="absolute inset-0"
            />

            {/* Background Blobs */}
            <View pointerEvents="none" className="absolute top-[-50] right-[-100] w-[300] h-[300] bg-primary/10 rounded-full blur-3xl" />
            <View pointerEvents="none" className="absolute bottom-[-100] left-[-50] w-[250] h-[250] bg-success/10 rounded-full blur-3xl" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
                >
                    <Animated.View entering={FadeInDown.delay(120).springify()} className="items-center mb-10">
                        <View className="w-16 h-16 bg-primary/10 rounded-2xl items-center justify-center mb-4 border border-primary/25">
                            <Ionicons name="person-add" size={32} color={accent} />
                        </View>
                        <Text className="text-4xl font-bold text-onSurface tracking-tight">
                            Create Account
                        </Text>
                        <Text className="text-onSurfaceVariant mt-2 text-base text-center px-6">
                            Join FinTrack and take control of your wealth today.
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(260).springify()} className="bg-surface border border-outline rounded-[32px] p-6 space-y-5">
                        {errors.general && (
                            <View className="bg-error/10 border border-error/25 p-4 rounded-2xl flex-row items-center">
                                <Ionicons name="alert-circle-outline" size={20} color={danger} />
                                <Text className="text-error ml-2 font-medium flex-1">{errors.general}</Text>
                            </View>
                        )}

                        <View className="space-y-2">
                            <Text className="text-onSurfaceVariant ml-1 font-medium text-sm">Full Name</Text>
                            <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-2xl px-4 h-14">
                                <Ionicons name="person-outline" size={20} color={muted} />
                                <TextInput
                                    className="flex-1 text-onSurface ml-3 text-base"
                                    placeholder="John Doe"
                                    placeholderTextColor={muted}
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />
                            </View>
                            {errors.name && <Text className="text-error text-xs ml-1">{errors.name}</Text>}
                        </View>

                        <View className="space-y-2">
                            <Text className="text-onSurfaceVariant ml-1 font-medium text-sm">Email Address</Text>
                            <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-2xl px-4 h-14">
                                <Ionicons name="mail-outline" size={20} color={muted} />
                                <TextInput
                                    className="flex-1 text-onSurface ml-3 text-base"
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
                            <Text className="text-onSurfaceVariant ml-1 font-medium text-sm">Password</Text>
                            <View className="flex-row items-center bg-surfaceVariant border border-outline rounded-2xl px-4 h-14">
                                <Ionicons name="lock-closed-outline" size={20} color={muted} />
                                <TextInput
                                    className="flex-1 text-onSurface ml-3 text-base"
                                    placeholder="••••••••"
                                    placeholderTextColor={muted}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={muted} />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text className="text-error text-xs ml-1">{errors.password}</Text>}

                            {password.length > 0 && (
                                <Animated.View entering={FadeInDown.duration(180)} className="mt-2 px-1">
                                    <View className="flex-row justify-between items-center mb-1.5">
                                        <Text className="text-onSurfaceVariant text-xs font-medium">Password Strength</Text>
                                        <Text className={`text-xs font-bold ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</Text>
                                    </View>
                                    <View className="h-1.5 w-full bg-surfaceVariant rounded-full overflow-hidden">
                                        <View
                                            className={`h-full ${strength.color} rounded-full`}
                                            style={{ width: strength.width }}
                                        />
                                    </View>
                                </Animated.View>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => setAgreed(!agreed)}
                            className="flex-row items-center py-2 px-1"
                            activeOpacity={0.7}
                        >
                            <View className={`w-6 h-6 rounded-lg border items-center justify-center ${agreed ? 'bg-primary border-primary' : 'border-outline bg-surfaceVariant'}`}>
                                {agreed && <Ionicons name="checkmark" size={16} color={isDark ? '#0A1710' : '#FBFAF7'} />}
                            </View>
                            <Text className="text-onSurfaceVariant ml-3 text-sm leading-5">
                                I agree to the{' '}
                                <Text onPress={handleOpenTerms} className="text-primary font-semibold">Terms of Service</Text>
                                {' '}and{' '}
                                <Text onPress={handleOpenPrivacy} className="text-primary font-semibold">Privacy Policy</Text>
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSignUp}
                            disabled={loading}
                            className="bg-primary h-16 rounded-2xl flex-row items-center justify-center mt-4 active:opacity-80 active:scale-95 transition-transform"
                        >
                            {loading ? (
                                <ActivityIndicator color={isDark ? '#0A1710' : '#FBFAF7'} />
                            ) : (
                                <Text className="text-primary-foreground font-bold text-lg">Create Account</Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    <View className="flex-row justify-center mt-10 mb-6">
                        <Text className="text-onSurfaceVariant text-base">Already have an account? </Text>
                        <TouchableOpacity
                            onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))}
                            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                            accessibilityRole="link"
                            accessibilityLabel="Sign in to an existing account"
                        >
                            <Text className="text-primary font-bold text-base">Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
