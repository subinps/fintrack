import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock, Lightbulb, LifeBuoy, Search, X } from 'lucide-react';
import { GUIDES, guideBySlug, searchGuides, type Guide } from '@/lib/guides';
import { IconBadge } from '@/components/system/IconBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/**
 * Help Centre (D5.4). One screen: search on the left of the reading order, the guide
 * index as a rail, and the article beside it. On phones the index and article swap.
 */
export function HelpTab() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [query, setQuery] = useState('');
  const [activeSlug, setActiveSlug] = useState(GUIDES[0].slug);
  const [mobileView, setMobileView] = useState<'index' | 'guide'>('index');
  const articleRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => searchGuides(query), [query]);
  const active = guideBySlug(activeSlug) ?? GUIDES[0];
  const position = GUIDES.findIndex((guide) => guide.slug === active.slug);
  const previous = position > 0 ? GUIDES[position - 1] : undefined;
  const next = position < GUIDES.length - 1 ? GUIDES[position + 1] : undefined;

  const openGuide = (slug: string) => {
    setActiveSlug(slug);
    setMobileView('guide');
  };

  useEffect(() => {
    if (isDesktop) return;
    window.scrollTo({ top: 0 });
  }, [mobileView, activeSlug, isDesktop]);

  useEffect(() => {
    if (mobileView !== 'guide') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    articleRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [mobileView, activeSlug]);

  const showIndex = isDesktop || mobileView === 'index';
  const showArticle = isDesktop || mobileView === 'guide';

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2">
            <LifeBuoy className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Help centre
          </p>
          <h1 className="mt-2 text-headline text-balance text-foreground">
            Answers without the accounting degree
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Eight short guides, written in plain language, for the things people actually get stuck
            on. Every step names the exact button you will see.
          </p>
        </div>
        <p className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex">
          <span className="tabular">{GUIDES.length} guides</span>
          <span className="h-1 w-1 rounded-full bg-border-strong" aria-hidden="true" />
          <span>About 30 minutes end to end</span>
        </p>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!isDesktop) setMobileView('index');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('');
              event.currentTarget.blur();
            }
          }}
          placeholder="Search guides — debit, splits, EMI, import, password…"
          aria-label="Search guides"
          className="h-12 rounded-2xl pl-10 pr-24 text-[14px]"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="h-8 gap-1 px-2 text-[12px]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
          <kbd
            className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block"
            aria-hidden="true"
          >
            Esc
          </kbd>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {query ? `${results.length} guide${results.length === 1 ? '' : 's'} match ${query}` : `${GUIDES.length} guides available`}
      </p>

      <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
        {showIndex && (
          <nav aria-label="Guides" className="space-y-2">
            {results.map((guide) => (
              <GuideRow
                key={guide.slug}
                guide={guide}
                active={guide.slug === active.slug}
                onSelect={() => openGuide(guide.slug)}
              />
            ))}

            {results.length === 0 && (
              <div
                className="panel flex flex-col items-center gap-3 px-5 py-8 text-center"
                role="status"
              >
                <IconBadge icon={Search} tone="neutral" size="lg" />
                <div>
                  <p className="text-title text-foreground">No guide matches “{query.trim()}”</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Try a word from the screen you are on — “import”, “split”, “EMI”, “session”.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                  Show all {GUIDES.length} guides
                </Button>
              </div>
            )}
          </nav>
        )}

        {showArticle && (
          <GuideArticle
            guide={active}
            articleRef={articleRef}
            onBack={!isDesktop && mobileView === 'guide' ? () => setMobileView('index') : undefined}
            onOpen={openGuide}
            previous={previous}
            next={next}
          />
        )}
      </div>
    </div>
  );
}

function GuideRow({
  guide,
  active,
  onSelect,
}: {
  guide: Guide;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors duration-layout ease-vault',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card hover:border-border-strong hover:bg-surface',
      )}
    >
      <IconBadge icon={guide.icon} tone={guide.tone} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-[13.5px] font-semibold',
              active ? 'text-primary-strong' : 'text-foreground',
            )}
          >
            {guide.title}
          </span>
          <span className="tabular shrink-0 text-[11px] text-muted-foreground">
            {guide.minutes} min
          </span>
        </span>
        <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
          {guide.summary}
        </span>
      </span>
    </button>
  );
}

function GuideArticle({
  guide,
  articleRef,
  onBack,
  onOpen,
  previous,
  next,
}: {
  guide: Guide;
  articleRef: React.MutableRefObject<HTMLElement | null>;
  onBack?: () => void;
  onOpen: (slug: string) => void;
  previous?: Guide;
  next?: Guide;
}) {
  const headingId = `guide-${guide.slug}`;

  return (
    <article ref={articleRef} aria-labelledby={headingId} className="panel scroll-mt-20 overflow-hidden">
      <div className="border-b border-border p-5 sm:p-7">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-3 gap-1.5 px-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All guides
          </Button>
        )}
        <div className="flex items-start gap-4">
          <IconBadge icon={guide.icon} tone={guide.tone} size="lg" />
          <div className="min-w-0">
            <h2 id={headingId} className="text-title-lg text-balance text-foreground">
              {guide.title}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              {guide.summary}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular">{guide.minutes} minute read</span>
              <span className="h-1 w-1 rounded-full bg-border-strong" aria-hidden="true" />
              <span className="tabular">
                {guide.sections.length} section{guide.sections.length === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {guide.sections.map((section) => (
          <section key={section.heading} className="p-5 sm:p-7">
            <h3 className="text-title text-foreground">{section.heading}</h3>
            <ol className="mt-3 space-y-2.5">
              {section.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span
                    className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-foreground/90">{step}</p>
                </li>
              ))}
            </ol>
            {section.tip && (
              <div className="mt-3.5 flex gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-strong">
                    Tip
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/90">
                    {section.tip}
                  </p>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="border-t border-border bg-surface/60 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow mr-1">Read next</p>
          {guide.related.map((slug) => {
            const related = guideBySlug(slug);
            if (!related) return null;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => onOpen(slug)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors duration-feedback hover:border-border-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <related.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {related.title}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {previous ? (
            <Button
              variant="outline"
              onClick={() => onOpen(previous.slug)}
              className="h-auto justify-start gap-2 py-2.5 text-left"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="eyebrow block">Previous</span>
                <span className="block truncate text-[13px] font-medium">{previous.title}</span>
              </span>
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          {next && (
            <Button
              variant="outline"
              onClick={() => onOpen(next.slug)}
              className="h-auto justify-between gap-2 py-2.5 text-right sm:col-start-2"
            >
              <span className="min-w-0">
                <span className="eyebrow block">Next</span>
                <span className="block truncate text-[13px] font-medium">{next.title}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
