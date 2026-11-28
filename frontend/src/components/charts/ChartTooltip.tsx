interface ChartTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string | number;
    formatter?: (value: number) => string;
    hideLabel?: boolean;
}

/** Shared chart tooltip: colour dot, series name, amount and its share of the hovered total. */
export function ChartTooltip({ active, payload, label, formatter, hideLabel }: ChartTooltipProps) {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const total = payload.reduce(
        (sum, entry) => sum + (typeof entry.value === 'number' ? Math.abs(entry.value) : 0),
        0
    );
    const showShare = payload.length > 1 && total > 0;

    return (
        <div className="min-w-[10rem] rounded-control border border-border bg-popover/95 p-3 shadow-lifted backdrop-blur-md">
            {!hideLabel && label !== undefined && label !== '' && (
                <p className="eyebrow mb-2 text-muted-foreground">{String(label)}</p>
            )}
            <div className="space-y-1.5">
                {payload.map((entry: any, index: number) => {
                    const share = showShare && typeof entry.value === 'number'
                        ? Math.round((Math.abs(entry.value) / total) * 100)
                        : null;
                    return (
                        <div key={index} className="flex items-center gap-2 text-small">
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: entry.color || entry.fill || entry.payload?.color }}
                            />
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.name}</span>
                            <span className="tabular text-small font-medium text-foreground">
                                {formatter && typeof entry.value === 'number' ? formatter(entry.value) : entry.value}
                            </span>
                            {share !== null && (
                                <span className="tabular w-9 shrink-0 text-right text-caption text-muted-foreground">
                                    {share}%
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
