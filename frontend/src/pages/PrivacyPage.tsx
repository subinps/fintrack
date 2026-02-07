import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart2 } from 'lucide-react';

export function PrivacyPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-sm z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                            <BarChart2 className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                            FinTrack
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </div>
            </header>

            <main className="pt-32 pb-20 px-4">
                <div className="container mx-auto max-w-3xl">
                    <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground">
                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Information We Collect</h2>
                            <p>
                                We collect information you provide directly to us when you create an account, use our services, or communicate with us. This may include:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Name and email address;</li>
                                <li>Financial transaction data you manually enter or import;</li>
                                <li>Account preferences and settings;</li>
                                <li>Communications with our support team.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">2. How We Use Your Information</h2>
                            <p>
                                We use the information we collect to:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Provide, maintain, and improve our services;</li>
                                <li>Process transactions and send related information;</li>
                                <li>Send you technical notices, updates, and support messages;</li>
                                <li>Monitor and analyze trends, usage, and activities in connection with our services;</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Data Security</h2>
                            <p>
                                We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Sharing</h2>
                            <p>
                                We do not share your personal information with third parties except as described in this policy:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>With your consent or at your direction;</li>
                                <li>With vendors, consultants, and other service providers who need access to such information to carry out work on our behalf;</li>
                                <li>In response to a request for information if we believe disclosure is in accordance with, or required by, any applicable law or legal process.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Your Choices</h2>
                            <p>
                                You may update, correct, or delete information about you at any time by logging into your online account or by contacting us. If you wish to delete your account, please contact us, but note that we may retain certain information as required by law or for legitimate business purposes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Cookies</h2>
                            <p>
                                Most web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove or reject browser cookies. Please note that if you choose to remove or reject cookies, this could affect the availability and functionality of our services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Changes to this Policy</h2>
                            <p>
                                We may change this privacy policy from time to time. If we make changes, we will notify you by revising the date at the top of the policy and, in some cases, we may provide you with additional notice.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Contact Us</h2>
                            <p>
                                If you have any questions about this privacy policy, please contact us at privacy@fintrack.com.
                            </p>
                        </section>

                        <p className="text-sm mt-12">Last updated: January 22, 2026</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
