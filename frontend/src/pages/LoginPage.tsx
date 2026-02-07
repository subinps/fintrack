import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BarChart2, Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

// Floating orb component for animated background
function FloatingOrb({
    className,
    delay = 0,
    duration = 20
}: {
    className: string;
    delay?: number;
    duration?: number;
}) {
    return (
        <motion.div
            className={`absolute rounded-full blur-3xl opacity-30 ${className}`}
            animate={{
                x: [0, 30, -20, 10, 0],
                y: [0, -40, 20, -10, 0],
                scale: [1, 1.1, 0.9, 1.05, 1],
            }}
            transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: "easeInOut",
            }}
        />
    );
}

export function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showResendVerification, setShowResendVerification] = useState(false);
    const [shake, setShake] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleResendVerification = async () => {
        if (!email) {
            toast.error('Please enter your email address first');
            return;
        }
        setLoading(true);
        try {
            await api.post('/auth/resend-verification', { email });
            toast.success('Verification email sent! Please check your inbox.');
            setShowResendVerification(false);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'Failed to send verification email';
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setShowResendVerification(false);

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const payload = isLogin ? { email, password } : { name, email, password };

            const res = await api.post(endpoint, payload);

            if (isLogin) {
                login(res.data.accessToken, res.data.refreshToken, res.data.user);
                toast.success('Logged in successfully');
            } else {
                navigate('/verify-email');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'An error occurred';
            triggerShake();

            if (errorMessage.toLowerCase().includes('verify') ||
                error.response?.status === 403) {
                setShowResendVerification(true);
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: "easeOut" as const },
        },
    };

    const shakeVariants = {
        shake: {
            x: [-10, 10, -10, 10, 0],
            transition: { duration: 0.4 },
        },
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden">
                <FloatingOrb
                    className="w-96 h-96 bg-primary/40 -top-20 -left-20"
                    duration={25}
                    delay={0}
                />
                <FloatingOrb
                    className="w-80 h-80 bg-blue-500/30 top-1/3 -right-20"
                    duration={30}
                    delay={2}
                />
                <FloatingOrb
                    className="w-72 h-72 bg-violet-500/30 bottom-0 left-1/4"
                    duration={22}
                    delay={4}
                />
                <FloatingOrb
                    className="w-64 h-64 bg-pink-500/20 -bottom-20 right-1/4"
                    duration={28}
                    delay={1}
                />
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />

            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>

            {/* Main Content */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 w-full max-w-md px-4"
            >
                <motion.div
                    variants={shakeVariants}
                    animate={shake ? "shake" : ""}
                >
                    {/* Glassmorphism Card */}
                    <div className="relative group">
                        {/* Card glow effect */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-violet-500/50 to-blue-500/50 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />

                        <div className="relative bg-background/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/10 dark:border-slate-700/50 rounded-3xl p-8 shadow-2xl">
                            {/* Header with Logo */}
                            <motion.div variants={itemVariants} className="text-center mb-8">
                                <Link to="/" className="inline-flex items-center space-x-3 mb-6 group/logo">
                                    <div className="h-12 w-12 bg-gradient-to-br from-primary to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover/logo:shadow-primary/50 transition-shadow">
                                        <BarChart2 className="h-7 w-7 text-primary-foreground" />
                                    </div>
                                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-500">
                                        FinTrack
                                    </span>
                                </Link>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={isLogin ? 'login' : 'signup'}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <h1 className="text-2xl font-bold text-foreground mb-2">
                                            {isLogin ? 'Welcome Back' : 'Create Account'}
                                        </h1>
                                        <p className="text-muted-foreground text-sm">
                                            {isLogin
                                                ? 'Enter your credentials to access your portfolio'
                                                : 'Sign up to start tracking your finances'}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </motion.div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <AnimatePresence mode="wait">
                                    {!isLogin && (
                                        <motion.div
                                            key="name-field"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <motion.div variants={itemVariants} className="space-y-2">
                                                <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Name</Label>
                                                <div className="relative group/input">
                                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                                                    <Input
                                                        id="name"
                                                        placeholder="John Doe"
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                        required={!isLogin}
                                                        className="pl-11 h-12 bg-background/50 dark:bg-slate-800/50 border-white/10 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
                                                    />
                                                </div>
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <motion.div variants={itemVariants} className="space-y-2">
                                    <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</Label>
                                    <div className="relative group/input">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="john@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="pl-11 h-12 bg-background/50 dark:bg-slate-800/50 border-white/10 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
                                        />
                                    </div>
                                </motion.div>

                                <motion.div variants={itemVariants} className="space-y-2">
                                    <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Password</Label>
                                    <div className="relative group/input">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="pl-11 pr-11 h-12 bg-background/50 dark:bg-slate-800/50 border-white/10 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" />
                                            ) : (
                                                <Eye className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                </motion.div>

                                {/* Resend Verification Email Section */}
                                <AnimatePresence>
                                    {showResendVerification && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                                <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                                                    Email not verified? Click below to resend the verification email.
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleResendVerification}
                                                    disabled={loading}
                                                    className="w-full border-amber-500/30 hover:bg-amber-500/10"
                                                >
                                                    {loading ? 'Sending...' : 'Resend Verification Email'}
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {isLogin && (
                                    <motion.div variants={itemVariants} className="flex justify-end">
                                        <Link
                                            to="/forgot-password"
                                            className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                                        >
                                            Forgot password?
                                        </Link>
                                    </motion.div>
                                )}

                                <motion.div variants={itemVariants} className="pt-2">
                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 rounded-xl transition-all duration-300 group/btn"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Please wait...
                                            </>
                                        ) : (
                                            <>
                                                {isLogin ? 'Sign In' : 'Create Account'}
                                                <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </motion.div>
                            </form>

                            {/* Divider */}
                            <motion.div variants={itemVariants} className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10 dark:border-slate-700" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background/60 dark:bg-slate-900/60 px-3 text-muted-foreground">
                                        or
                                    </span>
                                </div>
                            </motion.div>

                            {/* Toggle Login/Signup */}
                            <motion.div variants={itemVariants} className="text-center">
                                <button
                                    type="button"
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {isLogin
                                        ? "Don't have an account? "
                                        : "Already have an account? "}
                                    <span className="text-primary font-semibold hover:underline">
                                        {isLogin ? 'Sign up' : 'Sign in'}
                                    </span>
                                </button>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>

                {/* Footer text */}
                <motion.p
                    variants={itemVariants}
                    className="text-center text-xs text-muted-foreground mt-8"
                >
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                </motion.p>
            </motion.div>
        </div>
    );
}
