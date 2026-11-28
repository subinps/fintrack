import { useState, type ReactNode } from 'react';
import { ChevronDown, HelpCircle, Lightbulb } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * In-place guidance: every screen explains itself where it is used, so nobody has to
 * leave the page they are working on to find out what it does.
 */
export function PageGuide({
  title,
  steps,
  tip,
  defaultOpen = false,
}: {
  title: string;
  steps: string[];
  tip?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Hide how this page works' : 'How this page works'}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors duration-feedback hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {open ? 'Hide' : 'Show me how'}
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-layout ease-vault',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-border px-4 py-3.5">
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span
                  className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-strong text-[10.5px] font-semibold text-muted-foreground"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <p className="text-[12.5px] leading-relaxed text-foreground/90">{step}</p>
              </li>
            ))}
          </ol>
          {tip && (
            <div className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-[12px] leading-relaxed text-foreground/90">{tip}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** A "?" next to a term, for the words people hesitate over: split, opening balance, XIRR. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What ${label} means`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors duration-feedback hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 text-[12.5px] leading-relaxed text-foreground/90">
        <p className="eyebrow mb-1.5">{label}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}
