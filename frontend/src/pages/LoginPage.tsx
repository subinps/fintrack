import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BarChart3, Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, ShieldCheck, Server, Activity } from 'lucide-react';

const guarantees = [
  { icon: Server, label: 'Runs on your hardware', detail: 'Docker image or a Node process with Postgres or SQLite.' },
  { icon: ShieldCheck, label: 'No third-party analytics', detail: 'The app talks to your API and the price provider you configure.' },
  { icon: Activity, label: 'Readable state', detail: 'Every figure is derived from posted ledger entries, not typed twice.' },
];

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
    const reduceMotion = useReducedMotion();

    const handleResendVerification = async () => {
        if (!email) {
            toast.error('Enter your email address first');
            return;
        }
        setLoading(true);
        try {
            await api.post('/auth/resend-verification', { email });
            toast.success('Verification email sent. Check your inbox.');
            setShowResendVerification(false);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'Could not send the verification email';
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
            } else {
                navigate('/verify-email');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'Something went wrong. Try again.';
            triggerShake();

            if (errorMessage.toLowerCase().includes('verify') || error.response?.status === 403) {
                setShowResendVerification(true);
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            {/* Context panel */}
            <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-card p-10 lg:flex xl:p-14">
                <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
                <div className="relative">
                    <Link to="/" className="inline-flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-control border border-primary/30 bg-primary-soft">
                            <BarChart3 className="h-4 w-4 text-primary" />
                        </span>
                        <span className="leading-none">
                            <span className="block text-[15px] font-semibold tracking-[-0.02em]">FinTrack</span>
                            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                                Signal compass
                            </span>
                        </span>
                    </Link>
                </div>

                <div className="relative max-w-md">
                    <p className="eyebrow">System · live</p>
                    <h2 className="mt-4 text-display-sm">Your books, on your own server.</h2>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        Net worth, cash flow, holdings and debt on one grid — priced from market data,
                        stored in a database you control.
                    </p>

                    <ul className="mt-10 divide-y divide-border border-y border-border">
                        {guarantees.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.label} className="flex items-start gap-3 py-4">
                                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border bg-surface">
                                        <Icon className="h-3.5 w-3.5 text-primary" />
                                    </span>
                                    <div>
                                        <p className="text-[13px] font-medium text-foreground">{item.label}</p>
                                        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{item.detail}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <p className="relative font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    MIT licensed · No telemetry · Export everything
                </p>
            </aside>

            {/* Form column */}
            <main className="relative flex min-h-screen flex-col">
                <div className="flex items-center justify-between px-5 py-4 sm:px-8">
                    <Link to="/" className="flex items-center gap-2.5 lg:invisible">
                        <span className="flex h-7 w-7 items-center justify-center rounded-control border border-primary/30 bg-primary-soft">
                            <BarChart3 className="h-3.5 w-3.5 text-primary" />
                        </span>
                        <span className="text-[14px] font-semibold tracking-[-0.02em]">FinTrack</span>
                    </Link>
                    <div className="ml-auto">
                        <ThemeToggle />
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8">
                    <motion.div
                        className="w-full max-w-[26rem]"
                        animate={shake && !reduceMotion ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        <div className="mb-7">
                            <p className="eyebrow">{isLogin ? 'Returning session' : 'New ledger'}</p>
                            <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em]">
                                {isLogin ? 'Sign in to FinTrack' : 'Create your account'}
                            </h1>
                            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                                {isLogin
                                    ? 'Use the email and password for this instance.'
                                    : 'One account, one ledger. You can export or reset it at any time.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
                            {!isLogin && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="name" className="text-xs font-medium text-foreground">Name</Label>
                                    <div className="relative">
                                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                        <Input
                                            id="name"
                                            name="name"
                                            autoComplete="name"
                                            placeholder="Subin"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required={!isLogin}
                                            className="h-11 pl-10"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-medium text-foreground">Email</Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        inputMode="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="h-11 pl-10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-xs font-medium text-foreground">Password</Label>
                                    {isLogin && (
                                        <Link
                                            to="/forgot-password"
                                            className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                                        >
                                            Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-11 pl-10 pr-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {showResendVerification && (
                                <div className="rounded-control border border-warning/35 bg-warning/10 p-3">
                                    <p className="text-[12px] leading-relaxed text-warning">
                                        This email has not been verified. Send the verification link again.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleResendVerification}
                                        disabled={loading}
                                        className="mt-2.5 w-full border-warning/40"
                                    >
                                        {loading ? 'Sending…' : 'Resend verification email'}
                                    </Button>
                                </div>
                            )}

                            <Button type="submit" className="mt-2 h-11 w-full text-sm" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Please wait…
                                    </>
                                ) : (
                                    <>
                                        {isLogin ? 'Sign in' : 'Create account'}
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 flex items-center gap-3">
                            <span className="h-px flex-1 bg-border" />
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">or</span>
                            <span className="h-px flex-1 bg-border" />
                        </div>

                        <div className="mt-5 text-center text-[13px] text-muted-foreground">
                            <button
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="rounded-full px-2 py-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                                <span className="font-semibold text-primary">{isLogin ? 'Create one' : 'Sign in'}</span>
                            </button>
                        </div>

                        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
                            By continuing you agree to the{' '}
                            <Link to="/terms" className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground">terms of service</Link>
                            {' '}and{' '}
                            <Link to="/privacy" className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground">privacy policy</Link>.
                        </p>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
