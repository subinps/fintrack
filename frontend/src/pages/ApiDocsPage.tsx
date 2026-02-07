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
            <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-md z-50 supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                            <BarChart2 className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                            FinTrack
                        </span>
                    </div>
                    <Button variant="ghost" onClick={() => navigate('/')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </div>
            </header>

            <div className="container mx-auto px-4 pt-24 pb-12 flex gap-8">
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
                            <h1 className="text-4xl font-bold mb-4">API Documentation</h1>
                            <p className="text-xl text-muted-foreground mb-6">
                                Comprehensive reference for the FinTrack backend API. Manage your financial data programmatically.
                            </p>
                            <Card className="bg-muted/50 border-none">
                                <CardContent className="p-4">
                                    <div className="grid gap-2 text-sm font-mono">
                                        <div className="flex gap-4">
                                            <span className="text-muted-foreground w-32">Local Base URL:</span>
                                            <span className="text-foreground">http://localhost:3000/api</span>
                                        </div>
                                        <div className="flex gap-4">
                                            <span className="text-muted-foreground w-32">Production URL:</span>
                                            <span className="text-foreground">https://your-domain.com/api</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        {/* Authentication */}
                        <section id="auth" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
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
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-500">
                                    <strong>Important:</strong> Include the token in all subsequent requests:
                                    <code className="block mt-2 bg-black/20 p-2 rounded">Authorization: Bearer &lt;token&gt;</code>
                                </div>
                            </div>
                        </section>

                        {/* Accounts */}
                        <section id="accounts" className="scroll-mt-24">
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
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
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
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
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
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
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
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
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
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
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
                                <WorkflowIcon className="mr-2 h-6 w-6 text-primary" /> n8n Integration
                            </h2>
                            <Card className="bg-slate-950 border-slate-800">
                                <CardContent className="p-6">
                                    <h3 className="font-bold text-lg mb-4 text-slate-200">Automate Expense Tracking</h3>
                                    <ol className="list-decimal list-inside space-y-4 text-slate-400">
                                        <li>
                                            <strong className="text-slate-200">Get Token:</strong> Use the Login endpoint to get a long-lived token.
                                        </li>
                                        <li>
                                            <strong className="text-slate-200">Get IDs:</strong> Use <code>GET /accounts</code> to find your Bank ID and Category IDs.
                                        </li>
                                        <li>
                                            <strong className="text-slate-200">Configure n8n HTTP Request:</strong>
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
        <div
            onClick={onClick}
            className={`px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
        >
            {children}
        </div>
    );
}

function EndpointBlock({ method, path, description, payload, response }: { method: string, path: string, description: string, payload?: string, response?: string }) {
    const color = method === 'GET' ? 'text-blue-400 bg-blue-500/10' :
        method === 'POST' ? 'text-green-400 bg-green-500/10' :
            method === 'DELETE' ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10';

    return (
        <Card className="bg-background border-border overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${color}`}>{method}</span>
                    <code className="text-sm font-mono font-semibold">{path}</code>
                </div>
            </div>
            <CardContent className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">{description}</p>

                {payload && (
                    <div>
                        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Payload</div>
                        <pre className="bg-slate-950 text-slate-300 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
                            {payload}
                        </pre>
                    </div>
                )}

                {response && (
                    <div>
                        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Response</div>
                        <pre className="bg-slate-950 text-slate-300 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
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
