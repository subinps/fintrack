import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetNotifications, useMarkNotificationsRead } from '../hooks/useQueries';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useGetNotifications();
  const markRead = useMarkNotificationsRead();

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) markRead.mutate();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
          className="relative"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-none text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="eyebrow">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {isLoading && (
            <div className="space-y-3 p-4" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-full" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="p-4 text-[13px] text-muted-foreground">
              Could not load notifications.{' '}
              <button type="button" onClick={() => refetch()} className="font-medium text-primary-strong hover:underline">
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
              <p className="mt-3 text-[13px] font-medium text-foreground">Nothing yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Jobs, syncs and automation results land here.</p>
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className={cn('border-b border-border/70 px-4 py-3 last:border-0', !item.readAt && 'bg-primary-soft/40')}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium leading-snug text-foreground">{item.title}</p>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.body}</p>
              {item.href && (
                <a href={item.href} className="mt-2 inline-block text-[12px] font-medium text-primary-strong hover:underline">
                  Open
                </a>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
