import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function VerifyEmailPage() {
    const navigate = useNavigate();

    return (
        <div className="flex h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-full bg-primary/10">
                            <Mail className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Check your inbox</CardTitle>
                    <CardDescription className="text-base mt-2">
                        We've sent a verification link to your email address. Please click the link to activate your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Didn't receive the email? Check your spam folder or try signing up again.
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                        Back to Login
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
