import { useState, Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Menu, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ThemeToggle } from '../components/ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load tabs
const OverviewTab = lazy(() => import('../components/OverviewTab').then(module => ({ default: module.OverviewTab })));
const InvestmentsTab = lazy(() => import('../components/InvestmentsTab').then(module => ({ default: module.InvestmentsTab })));
const BankAccountsTab = lazy(() => import('../components/BankAccountsTab').then(module => ({ default: module.BankAccountsTab })));
const DebtsTab = lazy(() => import('../components/DebtsTab').then(module => ({ default: module.DebtsTab })));
const TransactionsTab = lazy(() => import('../components/TransactionsTab').then(module => ({ default: module.TransactionsTab })));
const ProfileTab = lazy(() => import('../components/ProfileTab').then(module => ({ default: module.ProfileTab })));
const IncomeExpenseTab = lazy(() => import('../components/IncomeExpenseTab').then(module => ({ default: module.IncomeExpenseTab })));
const ChartOfAccountsTab = lazy(() => import('../components/ChartOfAccountsTab').then(module => ({ default: module.ChartOfAccountsTab })));

export function Dashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setLogoutOpen(false);
  };

  const navigation = [
    { id: 'overview', label: 'Overview' },
    { id: 'income-expense', label: 'Income & Expenses' },
    { id: 'investments', label: 'Investments' },
    { id: 'accounts', label: 'Bank & Cash' },
    { id: 'chart-of-accounts', label: 'Chart of Accounts' },
    { id: 'debts', label: 'Debts' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'profile', label: 'Profile' },
  ];

  const TabLoading = () => (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-primary"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">
              FinTrack
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:block">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-background/50 backdrop-blur-md border border-white/10 h-12 p-1 rounded-full shadow-sm">
                {navigation.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="rounded-full px-6 h-full text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300"
                  >
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setLogoutOpen(true)} className="hidden md:flex">
              <LogOut className="h-5 w-5" />
            </Button>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-primary"
                      >
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <span className="text-lg font-bold">FinTrack</span>
                  </div>
                  {navigation.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeTab === item.id ? 'secondary' : 'ghost'}
                      className="justify-start"
                      onClick={() => setActiveTab(item.id)}
                    >
                      {item.label}
                    </Button>
                  ))}
                  <Button variant="destructive" className="mt-4" onClick={() => setLogoutOpen(true)}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be returned to the login screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <Suspense fallback={<TabLoading />}>
                {activeTab === 'overview' && (
                  <TabsContent value="overview" className="mt-0" forceMount>
                    <OverviewTab onNavigate={setActiveTab} />
                  </TabsContent>
                )}
                {activeTab === 'investments' && (
                  <TabsContent value="investments" className="mt-0" forceMount>
                    <InvestmentsTab />
                  </TabsContent>
                )}
                {activeTab === 'accounts' && (
                  <TabsContent value="accounts" className="space-y-4" forceMount>
                    <BankAccountsTab />
                  </TabsContent>
                )}
                {activeTab === 'chart-of-accounts' && (
                  <TabsContent value="chart-of-accounts" className="mt-0" forceMount>
                    <ChartOfAccountsTab />
                  </TabsContent>
                )}
                {activeTab === 'debts' && (
                  <TabsContent value="debts" className="mt-0" forceMount>
                    <DebtsTab />
                  </TabsContent>
                )}
                {activeTab === 'transactions' && (
                  <TabsContent value="transactions" className="mt-0" forceMount>
                    <TransactionsTab />
                  </TabsContent>
                )}
                {activeTab === 'income-expense' && (
                  <TabsContent value="income-expense" className="mt-0" forceMount>
                    <IncomeExpenseTab />
                  </TabsContent>
                )}
                {activeTab === 'profile' && (
                  <TabsContent value="profile" className="mt-0" forceMount>
                    <ProfileTab />
                  </TabsContent>
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}
