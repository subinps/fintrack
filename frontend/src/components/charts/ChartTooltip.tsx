interface ChartTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
    formatter?: (value: number) => string;
    hideLabel?: boolean;
}

export function ChartTooltip({ active, payload, label, formatter, hideLabel }: ChartTooltipProps) {
    if (active && payload && payload.length) {
        return (
            <div className="min-w-[9rem] rounded-control border border-border bg-popover/95 p-3 shadow-lifted backdrop-blur-md">
                {!hideLabel && label && (
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {label}
                    </p>
                )}
                <div className="space-y-1.5">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-[12px]">
                            <span
                                className="h-2 w-2 shrink-0 rounded-[1px]"
                                style={{ backgroundColor: entry.color || entry.fill }}
                            />
                            <span className="text-muted-foreground">
                                {entry.name}
                            </span>
                            <span className="tabular ml-auto font-mono text-[12px] font-medium text-foreground">
                                {formatter ? formatter(entry.value) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
}
