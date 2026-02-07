import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '../lib/api';
import { Link } from 'react-router-dom';

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.post('/auth/forgot-password', { email });
            setSubmitted(true);
            toast.success('Reset link sent to your email');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="flex h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Check your inbox</CardTitle>
                        <CardDescription>
                            We've sent a password reset link to <strong>{email}</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full" variant="outline">
                            <Link to="/login">Back to Login</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
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
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                        <Button asChild variant="link" className="text-sm text-muted-foreground">
                            <Link to="/login">Back to Login</Link>
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
