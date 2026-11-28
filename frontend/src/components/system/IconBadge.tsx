import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Colour families that carry meaning across the app (Night Vault, D1.2/D1.7). */
export type BadgeTone =
  | 'primary'
  | 'income'
  | 'expense'
  | 'assets'
  | 'liabilities'
  | 'equity'
  | 'investments'
  | 'savings'
  | 'info'
  | 'warning'
  | 'neutral';

const toneStyles: Record<BadgeTone, string> = {
  primary: 'bg-primary/10 text-primary ring-primary/20',
  income: 'bg-income/10 text-income ring-income/25',
  expense: 'bg-expense/10 text-expense ring-expense/25',
  assets: 'bg-assets/10 text-assets ring-assets/25',
  liabilities: 'bg-liabilities/10 text-liabilities ring-liabilities/25',
  equity: 'bg-equity/10 text-equity ring-equity/25',
  investments: 'bg-investments/10 text-investments ring-investments/25',
  savings: 'bg-savings/10 text-savings ring-savings/25',
  info: 'bg-info/10 text-info ring-info/25',
  warning: 'bg-warning/10 text-warning ring-warning/25',
  neutral: 'bg-surface-strong text-muted-foreground ring-border',
};

const sizes = {
  sm: { box: 'h-7 w-7 rounded-[9px]', icon: 'h-3.5 w-3.5', stroke: 2 },
  md: { box: 'h-9 w-9 rounded-[11px]', icon: 'h-4 w-4', stroke: 1.9 },
  lg: { box: 'h-11 w-11 rounded-[13px]', icon: 'h-5 w-5', stroke: 1.8 },
} as const;

/**
 * A tinted rounded square behind one icon: the single shape used for accounts,
 * categories, stat cards, guide topics and empty states.
 */
export function IconBadge({
  icon: Icon,
  tone = 'primary',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone?: BadgeTone;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center ring-1 ring-inset',
        s.box,
        toneStyles[tone],
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={s.icon} strokeWidth={s.stroke} />
    </span>
  );
}
