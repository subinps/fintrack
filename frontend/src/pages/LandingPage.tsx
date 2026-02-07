import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import {
  ArrowRight, BarChart2, Github, Zap, Layers,
  Server, Activity, Sparkles, Scale, Bell, Shield, Code,
  Database, TrendingUp, Smartphone, FileSpreadsheet
} from 'lucide-react';
import { Footer } from '@/components/Footer';

export function LandingPage() {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-md z-50 supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <BarChart2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              FinTrack
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="hidden md:flex hover:bg-primary/5" onClick={() => window.open('https://github.com/subinps/fintrack', '_blank')}>
              <Github className="mr-2 h-4 w-4" /> GitHub
            </Button>
            <Button variant="ghost" onClick={handleLoginClick} className="hover:bg-primary/5">Sign In</Button>
            <Button onClick={handleLoginClick} className="shadow-lg shadow-primary/20">Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-10" />
        <div className="container mx-auto text-center max-w-5xl">
          <div className="inline-flex items-center rounded-full border border-primary/20 px-4 py-1.5 text-sm font-medium mb-8 bg-primary/5 backdrop-blur-sm text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <Github className="h-4 w-4 mr-2" />
            100% Free & Open Source
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            Track Smart, <br /> Grow Fast.
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            The ultimate open-source personal finance tracker. Manage investments,
            track expenses, and visualize your net worth with total privacy and control.
            Self-hostable, API-first, and built for power users.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <Button size="lg" className="h-12 px-8 text-lg shadow-xl shadow-primary/20" onClick={handleLoginClick}>
              Start Tracking Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-lg hover:bg-primary/5" onClick={() => window.open('https://github.com/subinps/fintrack', '_blank')}>
              <Github className="mr-2 h-5 w-5" /> Star on GitHub
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section (Bento Grid) */}
      <section id="features" className="py-24 bg-muted/30 border-y scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need to master your money.</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features that were previously only available in expensive,
              proprietary software—now free and open for everyone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)] max-w-6xl mx-auto">

            {/* AI Automation - Large Card */}
            <div className="md:col-span-2 row-span-2 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-64 h-64 text-blue-500" />
              </div>
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
                    <Sparkles className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-4">AI-Powered Automation</h3>
                  <p className="text-slate-400 text-lg max-w-md">
                    Never manually enter a transaction again. FinTrack's mobile app uses Gemini AI to intelligently process your bank notifications and draft transactions for you.
                  </p>
                </div>
                <div className="mt-8 flex gap-3 flex-wrap">
                  <Badge icon={<Bell className="w-3 h-3" />} text="Notification Sync" />
                  <Badge icon={<Zap className="w-3 h-3" />} text="Auto-Categorization" />
                  <Badge icon={<Activity className="w-3 h-3" />} text="Smart Drafting" />
                </div>
              </div>
            </div>

            {/* Double Entry - Tall Card */}
            <div className="md:col-span-1 row-span-2 bg-slate-950 rounded-3xl p-8 border border-slate-800 shadow-xl flex flex-col relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6">
                <Scale className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Double-Entry Core</h3>
              <p className="text-slate-400 mb-6 flex-1">
                Professional accounting logic under the hood. Every transaction has a source and a destination, ensuring your books always balance perfectly.
              </p>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="flex justify-between">
                  <span>Assets:Bank</span>
                  <span className="text-red-400">-$50.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses:Food</span>
                  <span className="text-emerald-400">+$50.00</span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
                  <span>Balance</span>
                  <span>$0.00</span>
                </div>
              </div>
            </div>

            {/* Multi-Asset */}
            <div className="md:col-span-1 bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Multi-Asset Tracking</h3>
              <p className="text-slate-400 text-sm">
                Stocks, Crypto, Real Estate, Cash. Track your entire net worth in one unified dashboard.
              </p>
            </div>

            {/* Real-Time Prices */}
            <div className="md:col-span-1 bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Real-Time Markets</h3>
              <p className="text-slate-400 text-sm">
                Live price updates for your investment portfolio. Watch your net worth grow in real-time.
              </p>
            </div>

            {/* Cross Platform */}
            <div className="md:col-span-1 bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Cross-Platform</h3>
              <p className="text-slate-400 text-sm">
                Seamless sync between our powerful Web Dashboard and native Mobile Apps (iOS & Android).
              </p>
            </div>

            {/* Privacy & Self Hosting - Wide Card */}
            <div className="md:col-span-2 bg-slate-950 rounded-3xl p-8 border border-slate-800 shadow-xl flex items-center justify-between group hover:border-slate-700 transition-colors">
              <div className="max-w-md">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Privacy First & Self-Hosted</h3>
                </div>
                <p className="text-slate-400">
                  Your financial data belongs to you. Deploy FinTrack on your own server using Docker. No third-party tracking, no data selling. 100% Open Source.
                </p>
              </div>
              <div className="hidden md:flex space-x-4">
                <div className="text-center">
                  <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <span className="text-xs text-slate-500 font-mono">Docker</span>
                </div>
                <div className="text-center">
                  <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <span className="text-xs text-slate-500 font-mono">Postgres</span>
                </div>
                <div className="text-center">
                  <Code className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <span className="text-xs text-slate-500 font-mono">Open Source</span>
                </div>
              </div>
            </div>

            {/* Bulk Import */}
            <div className="md:col-span-1 bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Bulk Import</h3>
              <p className="text-slate-400 text-sm">
                Migrating from another app? Import thousands of transactions instantly via Excel or CSV.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Deployment Preview */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6">
            <Server className="mr-2 h-4 w-4" />
            Self-Hosting
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Deploy in minutes.</h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Whether you prefer Docker or CapRover, we have a guide for you. Own your infrastructure.
          </p>

          <div className="flex justify-center gap-4">
            <div className="bg-slate-950 rounded-xl p-6 border border-slate-800 text-left font-mono text-sm text-blue-400 shadow-xl">
              $ docker-compose up -d
            </div>
          </div>
        </div>
      </section>

      {/* API Preview */}
      <section className="py-24 bg-muted/30 border-y">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center rounded-lg bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-500 mb-6">
            <Activity className="mr-2 h-4 w-4" />
            For Developers
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">API First Design.</h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Automate your finances with our comprehensive REST API. Connect with n8n, Zapier, or build your own tools.
          </p>
          <Button size="lg" variant="outline" onClick={() => navigate('/api-docs')}>
            Read API Documentation <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-4xl bg-gradient-to-br from-primary to-primary/60 rounded-[40px] p-12 text-primary-foreground shadow-2xl shadow-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 relative z-10">Ready to take control?</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto relative z-10">
            Join thousands of users who are tracking their wealth the smart way.
            Free forever, open forever.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <Button size="lg" variant="secondary" className="h-14 px-10 text-lg font-bold shadow-lg" onClick={handleLoginClick}>
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm" onClick={() => window.open('https://github.com/subinps/fintrack', '_blank')}>
              View Source Code
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
      <span className="text-blue-400">{icon}</span>
      <span className="text-xs font-medium text-slate-300">{text}</span>
    </div>
  );
}
