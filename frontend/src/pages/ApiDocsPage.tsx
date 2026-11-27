import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    ArrowLeft, BarChart2
} from 'lucide-react';
import { Footer } from '@/components/Footer';

export function ApiDocsPage() {
    const navigate = useNavigate();

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur-md">
                <div className="container flex h-14 items-center justify-between">
                    <button type="button" className="flex items-center gap-2.5" onClick={() => navigate('/')}>
                        <span className="flex h-7 w-7 items-center justify-center rounded-control border border-primary/30 bg-primary-soft">
                            <BarChart2 className="h-4 w-4 text-primary" />
                        </span>
                        <span className="text-[15px] font-semibold tracking-[-0.02em]">FinTrack</span>
                        <span className="ml-1 rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                            API
                        </span>
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="h-4 w-4" /> Back to home
                    </Button>
                </div>
            </header>

            <div className="container flex gap-8 pb-12 pt-24">
                {/* Sidebar Navigation */}
                <aside className="hidden lg:block w-64 shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto pr-4">
                    <div className="space-y-1">
                        <h4 className="font-semibold mb-2 px-2">Getting Started</h4>
                        <NavItem onClick={() => scrollToSection('intro')} active>Introduction</NavItem>
                        <NavItem onClick={() => scrollToSection('auth')}>Authentication</NavItem>

                        <h4 className="font-semibold mt-6 mb-2 px-2">Resources</h4>
                        <NavItem onClick={() => scrollToSection('accounts')}>Accounts</NavItem>
                        <NavItem onClick={() => scrollToSection('transactions')}>Transactions</NavItem>
                        <NavItem onClick={() => scrollToSection('categories')}>Categories</NavItem>
                        <NavItem onClick={() => scrollToSection('prices')}>Market Prices</NavItem>
                        <NavItem onClick={() => scrollToSection('analytics')}>Analytics</NavItem>

                        <h4 className="font-semibold mt-6 mb-2 px-2">Guides</h4>
                        <NavItem onClick={() => scrollToSection('integration')}>n8n Integration</NavItem>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                    <div className="space-y-12 max-w-4xl">

                        {/* Introduction */}
                        <section id="intro" className="scroll-mt-24">
                            <p className="eyebrow mb-3">Reference</p>
                            <h1 className="mb-3 text-display-sm">API documentation</h1>
                            <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                                The same endpoints the dashboard calls. Authenticate with a JWT and manage every account,
                                transaction and category programmatically.
                            </p>
                            <Card className="bg-surface">
                                <CardContent className="p-4">
                                    <div className="grid gap-2 font-mono text-[12px]">
                                        <div className="flex flex-wrap gap-2 sm:gap-4">
                                            <span className="w-32 text-muted-foreground">Local base URL</span>
                                            <span className="text-foreground">http://localhost:3000/api</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 sm:gap-4">
                                            <span className="w-32 text-muted-foreground">Production URL</span>
                                            <span className="text-foreground">https://your-domain.com/api</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        {/* Authentication */}
                        <section id="auth" className="scroll-mt-24">
                            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                                <LockIcon className="mr-2 h-6 w-6 text-primary" /> Authentication
                            </h2>
                            <p className="mb-4 text-muted-foreground">
                                All API requests (except login/register) require a Bearer token in the header.
                            </p>

                            <div className="space-y-6">
                                <EndpointBlock
                                    method="POST"
                                    path="/auth/login"
                                    description="Authenticate and receive a JWT token."
                                    payload={`{
  "email": "john@example.com",
  "password": "securePassword123"
}`}
                                    response={`{
  "token": "eyJhbGciOiJIUzI1NiIsInR...",
  "user": { "id": 1, "name": "John Doe" }
}`}
                                />
                                <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-sm text-warning">
                                    <strong>Important:</strong> Include the token in all subsequent requests:
                                    <code className="block mt-2 bg-black/20 p-2 rounded">Authorization: Bearer &lt;token&gt;</code>
                                </div>
                            </div>
                        </section>

                        {/* Accounts */}
                        <section id="accounts" className="scroll-mt-24">
                            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                                <WalletIcon className="mr-2 h-6 w-6 text-primary" /> Accounts
                            </h2>
                            <div className="space-y-6">
                                <EndpointBlock
                                    method="GET"
                                    path="/accounts"
                                    description="List all accounts with current balances."
                                    response={`[
  {
    "id": 10,
    "name": "Chase Checking",
    "type": "ASSET",
    "balance": "150050", // In cents ($1500.50)
    "symbol": "USD"
  }
]`}
                                />
                                <EndpointBlock
                                    method="POST"
                                    path="/accounts"
                                    description="Create a new account."
                                    payload={`{
  "name": "Robinhood",
  "type": "ASSET", // ASSET, LIABILITY, INCOME, EXPENSE, EQUITY
  "subType": "stock",
  "openingBalance": "5000.00",
  "symbol": "USD"
}`}
                                />
                            </div>
                        </section>

                        {/* Transactions */}
                        <section id="transactions" className="scroll-mt-24">
                            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                                <ArrowLeftRightIcon className="mr-2 h-6 w-6 text-primary" /> Transactions
                            </h2>
                            <p className="mb-4 text-muted-foreground">
                                FinTrack uses <strong>Double-Entry Bookkeeping</strong>. Every transaction must have at least two splits that sum to zero.
                            </p>

                            <div className="space-y-6">
                                <EndpointBlock
                                    method="POST"
                                    path="/transactions"
                                    description="Create a transaction with splits."
                                    payload={`{
  "description": "Grocery Shopping",
  "date": "2024-03-20",
  "splits": [
    {
      "accountId": 10, // Bank (Asset)
      "amount": "-5000" // -$50.00 (Credit)
    },
    {
      "accountId": 25, // Groceries (Expense)
      "amount": "5000" // +$50.00 (Debit)
    }
  ]
}`}
                                />
                                <EndpointBlock
                                    method="POST"
                                    path="/transactions/import"
                                    description="Bulk import transactions from Excel."
                                    payload={`FormData:
- file: transactions.xlsx
- accountId: 10`}
                                />
                            </div>
                        </section>

                        {/* Categories */}
                        <section id="categories" className="scroll-mt-24">
                            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                                <TagsIcon className="mr-2 h-6 w-6 text-primary" /> Categories
                            </h2>
                            <div className="space-y-6">
                                <EndpointBlock
                                    method="GET"
                                    path="/categories"
                                    description="List all categories (Income/Expense accounts)."
                                />
                                <EndpointBlock
                                    method="POST"
                                    path="/categories"
                                    description="Create a new category."
                                    payload={`{
  "name": "Dining Out",
  "type": "EXPENSE"
}`}
                                />
                            </div>
                        </section>

                        {/* Market Prices */}
                        <section id="prices" className="scroll-mt-24">
                            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                                <TrendingUpIcon className="mr-2 h-6 w-6 text-primary" /> Market Prices
                            </h2>
                            <div className="space-y-6">
                                <EndpointBlock
                                    method="GET"
                                    path="/price/:symbol"
                                    description="Get real-time price for a symbol (e.g., AAPL, BTC)."
                                />
                            </div>
                        </section>

                        {/* Analytics */}
                        <section id="analytics" className="scroll-mt-24">
                            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                                <PieChartIcon className="mr-2 h-6 w-6 text-primary" /> Analytics
                            </h2>
                            <div className="space-y-6">
                                <EndpointBlock
                                    method="GET"
                                    path="/analytics/net-worth-history"
                                    description="Get historical net worth data for charting."
                                />
                            </div>
                        </section>

                        {/* Integration Guide */}
                        <section id="integration" className="scroll-mt-24">
                            <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                                <WorkflowIcon className="mr-2 h-6 w-6 text-primary" /> n8n Integration
                            </h2>
                            <Card className="code-block overflow-hidden">
                                <CardContent className="p-6">
                                    <h3 className="mb-4 text-base font-semibold text-[hsl(210_22%_92%)]">Automate expense tracking</h3>
                                    <ol className="list-decimal list-inside space-y-3 text-[13px] leading-relaxed text-[hsl(216_13%_70%)]">
                                        <li>
                                            <strong className="text-[hsl(210_22%_92%)]">Get a token:</strong> call the login endpoint and keep the access token.
                                        </li>
                                        <li>
                                            <strong className="text-[hsl(210_22%_92%)]">Find IDs:</strong> <code className="text-[hsl(222_89%_75%)]">GET /accounts</code> returns your account and category IDs.
                                        </li>
                                        <li>
                                            <strong className="text-[hsl(210_22%_92%)]">Configure the n8n HTTP request:</strong>
                                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                                <li>Method: <code>POST</code></li>
                                                <li>URL: <code>https://your-app.com/api/transactions</code></li>
                                                <li>Header: <code>Authorization: Bearer &lt;token&gt;</code></li>
                                                <li>Body: JSON payload with splits (see Transactions section).</li>
                                            </ul>
                                        </li>
                                    </ol>
                                </CardContent>
                            </Card>
                        </section>

                    </div>
                </main>
            </div>
            <Footer />
        </div>
    );
}

function NavItem({ children, active, onClick }: { children: React.ReactNode, active?: boolean, onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'location' : undefined}
            className={`flex min-h-8 w-full items-center rounded-control px-2 py-1.5 text-left text-[13px] transition-colors ${active
                ? 'bg-primary-soft text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
        >
            {children}
        </button>
    );
}

function EndpointBlock({ method, path, description, payload, response }: { method: string, path: string, description: string, payload?: string, response?: string }) {
    const color = method === 'GET' ? 'border-primary/25 bg-primary-soft text-primary' :
        method === 'POST' ? 'border-success/25 bg-success/10 text-success' :
            method === 'DELETE' ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-warning/25 bg-warning/10 text-warning';

    return (
        <Card className="overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <span className={`rounded-control border px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.08em] ${color}`}>{method}</span>
                    <code className="text-sm font-mono font-semibold">{path}</code>
                </div>
            </div>
            <CardContent className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">{description}</p>

                {payload && (
                    <div>
                        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Payload</div>
                        <pre className="code-block overflow-x-auto p-3 text-[11.5px] leading-relaxed">
                            {payload}
                        </pre>
                    </div>
                )}

                {response && (
                    <div>
                        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Response</div>
                        <pre className="code-block overflow-x-auto p-3 text-[11.5px] leading-relaxed">
                            {response}
                        </pre>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function LockIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}

function WalletIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
}

function ArrowLeftRightIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
}

function TagsIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19" /><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="6.5" cy="9.5" r=".5" fill="currentColor" /></svg>
}

function TrendingUpIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
}

function PieChartIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
}

function WorkflowIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="8" x="3" y="3" rx="2" /><rect width="8" height="8" x="13" y="13" rx="2" /><path d="m8 11 3 3 2.5-2.5" /></svg>
}
