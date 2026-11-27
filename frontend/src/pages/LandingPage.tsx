import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import {
  ArrowRight, ArrowUpRight, Github, BarChart3, RefreshCcw, ShieldCheck,
  Code2, Database, Lock, LineChart, Wallet, ReceiptText, CreditCard, Layers
} from 'lucide-react';
import { Footer } from '@/components/Footer';

const marqueeFacts = [
  'MIT LICENSED',
  'SELF-HOSTED',
  'POSTGRESQL OR SQLITE',
  'REST API + JWT',
  'NO TELEMETRY',
  'DARK & LIGHT',
];

const features = [
  {
    index: '01',
    title: 'Net worth on one line',
    body: 'Assets at market value minus what you owe, tracked against book value so unrealised gains are never a guess.',
    icon: Layers,
    metric: 'Assets − liabilities',
  },
  {
    index: '02',
    title: 'Cash flow without spreadsheets',
    body: 'Income and expenses categorised from the chart of accounts, with monthly totals and a category split.',
    icon: ReceiptText,
    metric: 'Monthly in / out',
  },
  {
    index: '03',
    title: 'Investments priced, not typed',
    body: 'Stocks, mutual funds and crypto hold units and a symbol; prices arrive on demand and are cached for the session.',
    icon: LineChart,
    metric: 'Units × price',
  },
  {
    index: '04',
    title: 'Debt you can see shrinking',
    body: 'Loans and payables sit next to your assets, so the number you watch is the one that actually matters.',
    icon: CreditCard,
    metric: 'Outstanding balance',
  },
];

const truths = [
  { icon: Lock, label: 'Data stays on your server', detail: 'Postgres or SQLite you control. No third-party analytics.' },
  { icon: Code2, label: 'Every screen has an API', detail: 'REST endpoints with JWT auth, documented in the app.' },
  { icon: RefreshCcw, label: 'Prices fetched, not hardcoded', detail: 'Market data is requested through your own instance.' },
  { icon: Database, label: 'Accounts, not accounts receivable', detail: 'Bank, cash, wallet, stock, ETF, crypto, bond and debt types.' },
];

function ProductPreview() {
  const bars = [34, 41, 38, 52, 47, 61, 58, 70, 66, 78, 74, 88];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-x-6 -top-8 bottom-0 rounded-[16px] border border-border/60 bg-surface/40" aria-hidden="true" />
      <div className="relative rounded-panel border border-border bg-card shadow-lifted">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Product preview
            </span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            workspace / overview
          </span>
        </div>
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">Net worth · market value</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-success">
                Solvent
              </span>
            </div>
            <p className="tabular mt-2 text-[clamp(1.5rem,1.1rem+1.4vw,2rem)] font-semibold leading-none tracking-tightest text-foreground">
              ₹48,20,500
            </p>
            <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-success">
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              +₹2,14,300 · 4.6% book
            </p>
          </div>

          <div className="flex h-20 items-end gap-1.5" aria-hidden="true">
            {bars.map((height, i) => (
              <div
                key={i}
                className="flex-1 rounded-[2px] bg-primary/80"
                style={{ height: `${height}%`, opacity: 0.35 + i * 0.05 }}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-control border border-border bg-border">
            {[
              { label: 'Cash', value: '₹8.4L', note: 'Liquid' },
              { label: 'Invested', value: '₹36.1L', note: 'Market' },
              { label: 'Owed', value: '₹2.9L', note: 'Debt' },
            ].map((stat) => (
              <div key={stat.label} className="bg-card px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                <p className="tabular mt-1 text-sm font-semibold text-foreground">{stat.value}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const handleLoginClick = () => navigate('/login');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-control border border-primary/30 bg-primary-soft">
              <BarChart3 className="h-4 w-4 text-primary" />
            </span>
            <span className="leading-none">
              <span className="text-[15px] font-semibold tracking-[-0.02em]">FinTrack</span>
              <span className="mt-0.5 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Signal compass
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <a href="#features" className="rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#system" className="rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              How it works
            </a>
            <Link to="/api-docs" className="rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              API docs
            </Link>
          </nav>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <a href="https://github.com/subinps/fintrack" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLoginClick}>
              Sign in
            </Button>
            <Button size="sm" onClick={handleLoginClick}>
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-80" aria-hidden="true" />
          <div className="container relative grid gap-12 pb-16 pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">
            <div className="rise-in">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                Open source · self-hosted
              </p>
              <h1 className="mt-6 text-display text-foreground">
                Every signal,<br />
                <span className="text-primary">one grid.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                FinTrack puts net worth, cash flow, holdings and debt on a single page — priced from
                real market data, stored in a database you own. No subscriptions, no telemetry,
                no spreadsheet to keep alive.
              </p>
              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                <Button size="lg" onClick={handleLoginClick}>
                  Start tracking
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="https://github.com/subinps/fintrack" target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                    Read the source
                  </a>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-5">
                {[
                  { label: 'Licence', value: 'MIT' },
                  { label: 'Deploy', value: 'Docker' },
                  { label: 'API', value: 'REST' },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rise-in lg:pl-4" style={{ animationDelay: '0.1s' }}>
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Fact strip */}
        <div className="border-b border-border bg-card">
          <div className="container flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-3">
            {marqueeFacts.map((fact) => (
              <span key={fact} className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {fact}
              </span>
            ))}
          </div>
        </div>

        {/* Features — hairline rows, not identical cards */}
        <section id="features" className="scroll-mt-16 border-b border-border py-16 lg:py-24">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:gap-16">
              <div>
                <p className="eyebrow">The instrument panel</p>
                <h2 className="mt-4 text-display-sm">Built for people who keep their own books.</h2>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Four views cover a personal balance sheet without the ceremony of accounting
                  software. Every figure is derived, never re-entered.
                </p>
                <Button variant="outline" className="mt-6" onClick={handleLoginClick}>
                  Open the dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <ol className="divide-y divide-border border-y border-border">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <li key={feature.index} className="group grid grid-cols-[auto_minmax(0,1fr)] gap-4 py-5 transition-colors hover:bg-surface/60 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:gap-5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-control border border-border bg-card">
                        <Icon className="h-4 w-4 text-primary" />
                      </span>
                      <div>
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">{feature.index}</span>
                          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{feature.title}</h3>
                        </div>
                        <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-muted-foreground">{feature.body}</p>
                      </div>
                      <span className="col-start-2 mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground sm:col-start-3 sm:mt-1">
                        {feature.metric}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        {/* How it works / API split */}
        <section id="system" className="scroll-mt-16 border-b border-border bg-surface py-16 lg:py-24">
          <div className="container grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="grid gap-6 sm:grid-cols-2">
              {truths.map((truth) => {
                const Icon = truth.icon;
                return (
                  <div key={truth.label} className="rounded-panel border border-border bg-card p-5">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="mt-4 text-[13px] font-semibold text-foreground">{truth.label}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{truth.detail}</p>
                  </div>
                );
              })}
            </div>
            <div>
              <p className="eyebrow">Under the hood</p>
              <h2 className="mt-4 text-display-sm">A ledger you can query.</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Sign in with JWT, read your own accounts, and script anything the interface can do.
                Every endpoint the dashboard uses is public and documented inside the app.
              </p>
              <div className="mt-6 overflow-hidden rounded-panel border border-border bg-[hsl(216_27%_6%)] shadow-panel">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">GET /api/analytics/net-worth-history</span>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(158_60%_60%)]">200</span>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[11.5px] leading-relaxed text-[hsl(210_22%_88%)]">
{`[
  {
    "date": "2026-11-27T00:00:00.000Z",
    "netWorth": 4820500,
    "assets": 5110500,
    "liabilities": 290000
  }
]`}
                </pre>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/api-docs">
                    <Code2 className="h-3.5 w-3.5" />
                    API reference
                  </Link>
                </Button>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <ShieldCheck className="mr-1 inline h-3 w-3" />
                  JWT · per-user scoping
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="container relative flex flex-col items-start gap-6 py-14 sm:flex-row sm:items-center sm:justify-between lg:py-20">
            <div>
              <p className="eyebrow">Ready when you are</p>
              <h2 className="mt-3 max-w-lg text-display-sm">Your money, on one grid, on your own server.</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Create an account on this instance, add one bank account, and the dashboard starts filling in.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button size="lg" onClick={handleLoginClick}>
                <Wallet className="h-4 w-4" />
                Create an account
              </Button>
              <Button size="lg" variant="outline" onClick={handleLoginClick}>
                Sign in
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
