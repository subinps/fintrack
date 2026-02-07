

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
            <div className="rounded-lg border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md">
                {!hideLabel && label && (
                    <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
                )}
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color || entry.fill }}
                            />
                            <span className="text-gray-300">
                                {entry.name}:
                            </span>
                            <span className="font-mono font-medium text-white">
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
