import { Link } from 'react-router-dom';
import { BarChart2, Github, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
    return (
        <footer className="bg-background border-t">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                                <BarChart2 className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                                FinTrack
                            </span>
                        </div>
                        <p className="text-muted-foreground max-w-sm mb-6">
                            Empowering you to take control of your financial future with smart tracking and beautiful analytics.
                        </p>
                        <div className="flex space-x-4">
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <Twitter className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <Github className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <Linkedin className="h-5 w-5" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4 text-foreground">Product</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="/#features" className="hover:text-primary transition-colors">Features</a></li>
                            <li><Link to="/api-docs" className="hover:text-primary transition-colors">API Docs</Link></li>
                            <li><a href="https://github.com/subinps/fintrack" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
                                <Github className="h-3 w-3" /> GitHub
                            </a></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4 text-foreground">Legal</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                            </li>
                            <li>
                                <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                            </li>
                            <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} FinTrack. All rights reserved.
                    </p>
                    <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                        <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
                        <a href="#" className="hover:text-primary transition-colors">Contact</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
