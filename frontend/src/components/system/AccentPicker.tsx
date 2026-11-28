import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ACCENTS, ACCENT_STORAGE_KEY, applyAccent, isAccentId, type AccentId } from './accent';
import { cn } from '@/lib/utils';

/** D1.5: one accent at a time, saved per browser, applied through the primary token. */
export function AccentPicker() {
  const [accent, setAccent] = useState<AccentId>('blue');

  useEffect(() => {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentId(stored)) setAccent(stored);
  }, []);

  const choose = (id: AccentId) => {
    setAccent(id);
    applyAccent(id);
  };

  return (
    <div>
      <p className="eyebrow mb-2 px-1">Accent colour</p>
      <div className="flex items-center gap-1.5" role="group" aria-label="Accent colour">
        {ACCENTS.map((option) => {
          const selected = option.id === accent;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              aria-pressed={selected}
              title={option.label}
              className={cn(
                'accent-swatch relative flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ring-border transition-transform duration-feedback ease-vault hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover',
                selected && 'ring-2 ring-ring',
              )}
              data-swatch={option.id}
            >
              <span className="sr-only">{option.label}</span>
              {selected && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
