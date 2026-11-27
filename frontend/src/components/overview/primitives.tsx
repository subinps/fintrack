import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPct } from '@/lib/finance';

export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-[17px] font-semibold tracking-[-0.025em] text-foreground">{title}</h2>
        {description ? <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type Tone = 'positive' | 'warning' | 'critical' | 'neutral';

const toneFill: Record<Tone, string> = {
  positive: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-destructive',
  neutral: 'bg-muted-foreground',
};

const toneRing: Record<Tone, string> = {
  positive: 'shadow-[0_0_0_3px_hsl(var(--success)/0.16)]',
  warning: 'shadow-[0_0_0_3px_hsl(var(--warning)/0.16)]',
  critical: 'shadow-[0_0_0_3px_hsl(var(--destructive)/0.16)]',
  neutral: 'shadow-[0_0_0_3px_hsl(var(--muted-foreground)/0.16)]',
};

export function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      className={cn('inline-block h-1.5 w-1.5 rounded-full', toneFill[tone], toneRing[tone], className)}
      aria-hidden="true"
    />
  );
}

/** Change chip. `invert` flips which direction counts as good (spending up is bad). */
export function DeltaChip({
  value,
  invert = false,
  suffix,
  emptyLabel = 'No prior month',
  className,
}: {
  value: number | null;
  invert?: boolean;
  suffix?: string;
  emptyLabel?: string;
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn('mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground', className)}>{emptyLabel}</span>;
  }
  const flat = Math.abs(value) < 0.5;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-mono text-[11px] font-medium',
        flat
          ? 'border-border bg-muted/60 text-muted-foreground'
          : good
            ? 'border-success/25 bg-success/10 text-success'
            : 'border-destructive/25 bg-destructive/10 text-destructive',
        className
      )}
      title={suffix ? `${formatPct(value)} ${suffix}` : formatPct(value)}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatPct(value, Math.abs(value) >= 100 ? 0 : 1)}
      {suffix ? <span className="font-sans text-[10px] font-normal opacity-80">{suffix}</span> : null}
    </span>
  );
}

export function Sparkline({
  values,
  tone = 'positive',
  width = 120,
  height = 36,
  className,
  ariaLabel,
}: {
  values: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  className?: string;
  ariaLabel: string;
}) {
  if (values.length < 2) return <div className={cn('h-9', className)} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [index * step, height - 3 - ((value - min) / span) * (height - 6)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const stroke =
    tone === 'positive'
      ? 'hsl(var(--chart-1))'
      : tone === 'critical'
        ? 'hsl(var(--destructive))'
        : tone === 'warning'
          ? 'hsl(var(--chart-3))'
          : 'hsl(var(--muted-foreground))';
  const id = `spark-${tone}-${values.length}-${Math.round(values[0])}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.4" fill={stroke} />
    </svg>
  );
}

/** 270° compass arc used for the financial health score. */
export function CompassGauge({ score, band }: { score: number; band: string }) {
  const size = 168;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const startAngle = 135;
  const sweep = 270;
  const polar = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [center + radius * Math.cos(rad), center + radius * Math.sin(rad)];
  };
  const [sx, sy] = polar(startAngle);
  const [ex, ey] = polar(startAngle + sweep);
  const trackPath = `M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey}`;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const [px, py] = polar(startAngle + sweep * progress);
  const largeArc = sweep * progress > 180 ? 1 : 0;
  const progressPath = `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${px} ${py}`;
  const strokeColor = score >= 70 ? 'hsl(var(--chart-1))' : score >= 45 ? 'hsl(var(--chart-3))' : 'hsl(var(--destructive))';
  return (
    <div className="relative">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Financial health score ${score} out of 100, ${band}`}
      >
        <path d={trackPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={progressPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 600ms var(--ease-out)' }}
        />
        {[0, 25, 50, 75, 100].map((tick) => {
          const [tx1, ty1] = polar(startAngle + (sweep * tick) / 100);
          const [tx2, ty2] = polar(startAngle + (sweep * tick) / 100);
          const inward = tick % 50 === 0 ? 8 : 5;
          const rad = ((startAngle + (sweep * tick) / 100 - 90) * Math.PI) / 180;
          return (
            <line
              key={tick}
              x1={tx1}
              y1={ty1}
              x2={tx2 - Math.cos(rad) * inward}
              y2={ty2 - Math.sin(rad) * inward}
              stroke="hsl(var(--border-strong))"
              strokeWidth="1"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className="stat-value text-[40px] leading-none text-foreground">{score}</span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{band}</span>
      </div>
    </div>
  );
}

export function MeterRow({
  label,
  value,
  max = 100,
  detail,
  color = 'hsl(var(--chart-1))',
}: {
  label: string;
  value: number;
  max?: number;
  detail: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-foreground">{label}</span>
        <span className="mono text-[11px] text-muted-foreground">
          {Math.round(value)}
          <span className="opacity-60">/{max}</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-control', className)} aria-hidden="true" />;
}

export function ErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="panel flex flex-col items-start gap-3 p-5" role="alert">
      <div className="flex h-9 w-9 items-center justify-center rounded-control bg-destructive/10">
        <RefreshCw className="h-4 w-4 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          The ledger did not respond. Check your connection; your data is untouched.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-card px-2.5 text-[12px] font-medium text-foreground transition-colors hover:border-border-strong"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
