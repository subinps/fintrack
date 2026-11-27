import { Link } from 'react-router-dom';
import { BarChart3, Github } from 'lucide-react';

export function Footer() {
    return (
        <footer className="bg-background">
            <div className="container py-12">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-control border border-primary/30 bg-primary-soft">
                                <BarChart3 className="h-4 w-4 text-primary" />
                            </span>
                            <span className="text-[15px] font-semibold tracking-[-0.02em]">FinTrack</span>
                        </div>
                        <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                            An open-source personal ledger. Net worth, cash flow, investments and debt —
                            kept in a database you own.
                        </p>
                        <a
                            href="https://github.com/subinps/fintrack"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                        >
                            <Github className="h-3 w-3" />
                            github.com/subinps/fintrack
                        </a>
                    </div>

                    <div>
                        <h3 className="eyebrow mb-4">Product</h3>
                        <ul className="space-y-2.5 text-[13px] text-muted-foreground">
                            <li><a href="/#features" className="transition-colors hover:text-foreground">Features</a></li>
                            <li><Link to="/api-docs" className="transition-colors hover:text-foreground">API docs</Link></li>
                            <li><Link to="/login" className="transition-colors hover:text-foreground">Sign in</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="eyebrow mb-4">Legal</h3>
                        <ul className="space-y-2.5 text-[13px] text-muted-foreground">
                            <li><Link to="/privacy" className="transition-colors hover:text-foreground">Privacy policy</Link></li>
                            <li><Link to="/terms" className="transition-colors hover:text-foreground">Terms of service</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        © {new Date().getFullYear()} FinTrack · MIT licensed
                    </p>
                    <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
                        <Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
