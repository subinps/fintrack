import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart2 } from 'lucide-react';

export function TermsPage() {
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
                    <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground">
                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
                            <p>
                                By accessing and using FinTrack, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Use License</h2>
                            <p>
                                Permission is granted to temporarily use FinTrack for personal, non-commercial transitory viewing and financial tracking only. This is the grant of a license, not a transfer of title, and under this license you may not:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Modify or copy the materials;</li>
                                <li>Use the materials for any commercial purpose;</li>
                                <li>Attempt to decompile or reverse engineer any software contained in FinTrack;</li>
                                <li>Remove any copyright or other proprietary notations from the materials.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Disclaimer</h2>
                            <p>
                                The materials on FinTrack are provided on an 'as is' basis. FinTrack makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                            </p>
                            <p className="mt-2">
                                Furthermore, FinTrack does not warrant or make any representations concerning the accuracy, likely results, or reliability of the use of the materials on its website or otherwise relating to such materials or on any sites linked to this site.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Limitations</h2>
                            <p>
                                In no event shall FinTrack or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use FinTrack, even if FinTrack or a FinTrack authorized representative has been notified orally or in writing of the possibility of such damage.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Accuracy of Materials</h2>
                            <p>
                                The materials appearing on FinTrack could include technical, typographical, or photographic errors. FinTrack does not warrant that any of the materials on its website are accurate, complete or current. FinTrack may make changes to the materials contained on its website at any time without notice.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Links</h2>
                            <p>
                                FinTrack has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by FinTrack of the site. Use of any such linked website is at the user's own risk.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Modifications</h2>
                            <p>
                                FinTrack may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Governing Law</h2>
                            <p>
                                These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
                            </p>
                        </section>

                        <p className="text-sm mt-12">Last updated: January 22, 2026</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
