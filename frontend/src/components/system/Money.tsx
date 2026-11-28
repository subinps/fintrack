import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/lib/finance';
import { cn } from '@/lib/utils';

type MoneyTone = 'inherit' | 'auto' | 'income' | 'expense' | 'muted';

const toneClass: Record<MoneyTone, string> = {
  inherit: '',
  auto: '',
  income: 'text-income',
  expense: 'text-expense',
  muted: 'text-muted-foreground',
};

/**
 * One money renderer for the whole app: Indian grouping, tabular figures and an
 * optional count-up that stops at the real value (and is skipped under reduced motion).
 */
export function Money({
  paise,
  compact = false,
  signed = false,
  decimals,
  tone = 'inherit',
  animate = false,
  className,
}: {
  paise: number;
  compact?: boolean;
  signed?: boolean;
  decimals?: number;
  tone?: MoneyTone;
  animate?: boolean;
  className?: string;
}) {
  const shown = useCountUp(paise, animate);
  const resolvedTone: MoneyTone =
    tone === 'auto' ? (paise < 0 ? 'expense' : 'income') : tone;

  return (
    <span className={cn('tabular', toneClass[resolvedTone], className)}>
      {formatINR(shown, { compact, signed, decimals })}
    </span>
  );
}

function useCountUp(target: number, animate: boolean) {
  const [value, setValue] = useState(animate ? 0 : target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!animate || reduced) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const from = 0;
    const duration = 640;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, animate]);

  return value;
}
