import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showResendVerification, setShowResendVerification] = useState(false);
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

            // Check if it's a verification error
            if (errorMessage.toLowerCase().includes('verify') ||
                error.response?.status === 403) {
                setShowResendVerification(true);
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-background p-4 relative">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md"
            >
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
                        <CardDescription>
                            {isLogin ? 'Enter your credentials to access your portfolio' : 'Sign up to start tracking your finances'}
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="John Doe"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Resend Verification Email Section */}
                            {showResendVerification && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                                        Email not verified? Click below to resend the verification email.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleResendVerification}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        {loading ? 'Sending...' : 'Resend Verification Email'}
                                    </Button>
                                </div>
                            )}

                            {isLogin && (
                                <div className="flex justify-end">
                                    <Link
                                        to="/forgot-password"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Loading...' : (isLogin ? 'Login' : 'Sign Up')}
                            </Button>
                            <Button
                                type="button"
                                variant="link"
                                className="text-sm text-muted-foreground"
                                onClick={() => setIsLogin(!isLogin)}
                            >
                                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </motion.div>
        </div>
    );
}
