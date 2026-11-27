import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  ArrowLeftRight,
  CreditCard,
  Landmark,
  LayoutGrid,
  ListTree,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Sun,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const pages = [
  { id: 'overview', label: 'Overview', hint: 'Net worth and signals', icon: LayoutGrid },
  { id: 'income-expense', label: 'Income & expenses', hint: 'Cash in against cash out', icon: ArrowLeftRight },
  { id: 'investments', label: 'Investments', hint: 'Holdings and market value', icon: TrendingUp },
  { id: 'accounts', label: 'Bank & cash', hint: 'Liquid balances', icon: Landmark },
  { id: 'transactions', label: 'Transactions', hint: 'Every posted entry', icon: ReceiptText },
  { id: 'chart-of-accounts', label: 'Chart of accounts', hint: 'The account tree', icon: ListTree },
  { id: 'debts', label: 'Debts', hint: 'Loans and cards', icon: CreditCard },
  { id: 'profile', label: 'Profile', hint: 'Data and preferences', icon: UserRound },
];

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onNewTransaction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
  onNewTransaction: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matchingPages = useMemo(
    () => pages.filter((page) => !needle || `${page.label} ${page.hint}`.toLowerCase().includes(needle)),
    [needle]
  );
  const actions = useMemo(
    () => [
      {
        id: 'new-transaction',
        label: 'New transaction',
        hint: 'Record income or an expense',
        icon: Plus,
        run: onNewTransaction,
        keywords: 'new transaction record expense income add',
      },
      {
        id: 'theme',
        label: `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`,
        hint: 'Appearance',
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        run: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
        keywords: 'toggle theme dark light appearance',
      },
    ].filter((action) => !needle || `${action.label} ${action.keywords}`.toLowerCase().includes(needle)),
    [needle, resolvedTheme, setTheme, onNewTransaction]
  );

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const empty = matchingPages.length === 0 && actions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search pages and actions</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to a page or run a workspace action.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages or actions…"
            aria-label="Command search"
            className="h-12 w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="mono shrink-0 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-2">
          {empty ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : null}

          {actions.length ? (
            <div role="group" aria-label="Actions">
              <p className="eyebrow px-3 pb-1.5 pt-2">Actions</p>
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  aria-label={action.label}
                  onClick={() => run(action.run)}
                  className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <action.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex-1">{action.label}</span>
                  <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {action.hint}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {matchingPages.length ? (
            <div role="group" aria-label="Go to" className="mt-1 border-t border-border/70 pt-1">
              <p className="eyebrow px-3 pb-1.5 pt-2">Go to</p>
              {matchingPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  aria-label={page.label}
                  onClick={() => run(() => onNavigate(page.id))}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'
                  )}
                >
                  <page.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">{page.label}</span>
                  <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{page.hint}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <span className="eyebrow">Navigate</span>
          <span className="mono text-[10px] text-muted-foreground">tab to move · ↵ open · esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
