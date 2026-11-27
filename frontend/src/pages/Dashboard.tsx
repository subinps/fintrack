import { useState, Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import {
  ArrowLeftRight,
  CreditCard,
  Landmark,
  LayoutGrid,
  LineChart,
  ListTree,
  LogOut,
  Menu,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ThemeToggle } from '../components/ThemeToggle';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Lazy load tabs
const OverviewTab = lazy(() => import('../components/OverviewTab').then(module => ({ default: module.OverviewTab })));
const InvestmentsTab = lazy(() => import('../components/InvestmentsTab').then(module => ({ default: module.InvestmentsTab })));
const BankAccountsTab = lazy(() => import('../components/BankAccountsTab').then(module => ({ default: module.BankAccountsTab })));
const DebtsTab = lazy(() => import('../components/DebtsTab').then(module => ({ default: module.DebtsTab })));
const TransactionsTab = lazy(() => import('../components/TransactionsTab').then(module => ({ default: module.TransactionsTab })));
const ProfileTab = lazy(() => import('../components/ProfileTab').then(module => ({ default: module.ProfileTab })));
const IncomeExpenseTab = lazy(() => import('../components/IncomeExpenseTab').then(module => ({ default: module.IncomeExpenseTab })));
const ChartOfAccountsTab = lazy(() => import('../components/ChartOfAccountsTab').then(module => ({ default: module.ChartOfAccountsTab })));

const navigation = [
  {
    group: 'Position',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutGrid, hint: 'Net worth, allocation, momentum' },
      { id: 'income-expense', label: 'Income & Expenses', icon: ArrowLeftRight, hint: 'Cash in against cash out' },
      { id: 'investments', label: 'Investments', icon: LineChart, hint: 'Holdings and market value' },
      { id: 'accounts', label: 'Bank & Cash', icon: Landmark, hint: 'Liquid balances' },
    ],
  },
  {
    group: 'Ledger',
    items: [
      { id: 'transactions', label: 'Transactions', icon: ReceiptText, hint: 'Every posted entry' },
      { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: ListTree, hint: 'The account tree' },
    ],
  },
  {
    group: 'Commitments',
    items: [{ id: 'debts', label: 'Debts', icon: CreditCard, hint: 'Owed and owed to you' }],
  },
  {
    group: 'Account',
    items: [{ id: 'profile', label: 'Profile', icon: UserRound, hint: 'Data and preferences' }],
  },
];

const navItems = navigation.flatMap((group) => group.items);

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-control border border-primary/30 bg-primary-soft">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-primary"
          aria-hidden="true"
        >
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div className="leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">FinTrack</span>
        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          Personal ledger
        </span>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
  compact = false,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-label={`${item.label} tab`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-control px-3 text-left transition-[background-color,color,box-shadow] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        compact ? 'min-h-11 py-2.5' : 'min-h-10 py-2',
        active
          ? 'bg-primary-soft text-primary-strong shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-strong' : 'text-muted-foreground/80 group-hover:text-foreground')} />
      <span className="truncate text-[13px] font-medium">{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
    </button>
  );
}

export function Dashboard() {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(false);
  const reduceMotion = useReducedMotion();

  const activeItem = navItems.find((item) => item.id === activeTab) ?? navItems[0];
  const initials = (user?.name || user?.email || 'FT')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const handleLogout = () => {
    logout();
    setLogoutOpen(false);
  };

  const handleNavigate = (id: string) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  };

  const TabLoading = () => (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded-sm shimmer" />
        <div className="h-9 w-80 max-w-full rounded-control shimmer" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-panel border border-border bg-card p-5">
            <div className="h-2.5 w-20 rounded-sm shimmer" />
            <div className="mt-4 h-6 w-32 rounded-sm shimmer" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded-panel border border-border bg-card shimmer" />
      <span className="sr-only">Loading {activeItem.label}</span>
    </div>
  );

  const sidebar = (compact = false) => (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto">
      {navigation.map((group) => (
        <div key={group.group}>
          <p className="eyebrow mb-2 px-3">{group.group}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activeTab === item.id}
                onSelect={handleNavigate}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lifted focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <div className="lg:grid lg:grid-cols-[252px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)]">
        {/* Desktop rail */}
        <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-border bg-card px-3 pb-4 pt-5 lg:flex">
          <div className="px-2">
            <Brand />
          </div>
          {sidebar()}
          <div className="mt-auto space-y-3 border-t border-border pt-4">
            <div className="rounded-panel border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Session</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                  Active
                </span>
              </div>
              <p className="mt-1.5 truncate text-[12px] font-medium text-foreground">{user?.name || 'Signed in'}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLogoutOpen(true)}
                aria-label="Sign out"
                className="ml-auto"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
            <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-[19rem] flex-col border-border bg-card px-3 pb-6 pt-5">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="mb-5 flex items-center px-1">
                    <Brand />
                  </div>
                  {sidebar(true)}
                  <div className="mt-auto space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2 px-1">
                      <ThemeToggle />
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setLogoutOpen(true)}>
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="lg:hidden">
                <Brand />
              </div>

              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace</span>
                <span aria-hidden="true" className="h-3 w-px bg-border-strong" />
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
                  {activeItem.label}
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Connected</span>
                </span>
                <div className="lg:hidden">
                  <ThemeToggle />
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-1 lg:pr-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft font-mono text-[11px] font-semibold uppercase text-primary-strong">
                    {initials || 'FT'}
                  </span>
                  <span className="hidden max-w-[10rem] truncate text-[12px] font-medium text-foreground lg:block">
                    {user?.name || user?.email}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setLogoutOpen(true)}
                    aria-label="Sign out"
                    className="hidden lg:inline-flex"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <motion.div
                key={activeTab}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <Suspense fallback={<TabLoading />}>
                  {activeTab === 'overview' && <OverviewTab onNavigate={(tab) => { if (tab === 'transactions') setPendingTransaction(true); setActiveTab(tab); }} />}
                  {activeTab === 'investments' && <InvestmentsTab />}
                  {activeTab === 'accounts' && <BankAccountsTab />}
                  {activeTab === 'chart-of-accounts' && <ChartOfAccountsTab />}
                  {activeTab === 'debts' && <DebtsTab />}
                  {activeTab === 'transactions' && <TransactionsTab initialAddOpen={pendingTransaction} onInitialAddConsumed={() => setPendingTransaction(false)} />}
                  {activeTab === 'income-expense' && <IncomeExpenseTab />}
                  {activeTab === 'profile' && <ProfileTab />}
                </Suspense>
              </motion.div>
            </div>
          </main>

          <footer className="border-t border-border px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 sm:flex-row">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                FinTrack · Self-hosted ledger
              </span>
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Data stays on your server
              </span>
            </div>
          </footer>
        </div>
      </div>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of FinTrack?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be returned to the sign-in screen. Your ledger stays on your server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
