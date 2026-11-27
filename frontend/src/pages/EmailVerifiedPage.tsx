import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export function EmailVerifiedPage() {
    const navigate = useNavigate();

    return (
        <div className="flex h-screen items-center justify-center bg-background p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <Card className="text-center border-primary/20 shadow-lg">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                                className="p-3 rounded-full bg-success/10"
                            >
                                <CheckCircle className="h-12 w-12 text-success" />
                            </motion.div>
                        </div>
                        <CardTitle className="text-2xl">Email Verified!</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Your email address has been successfully verified. You can now access your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            className="w-full bg-primary hover:bg-primary/90"
                            size="lg"
                            onClick={() => navigate('/login')}
                        >
                            Return to Login
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
