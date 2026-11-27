import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { format } from 'date-fns';

interface DataItem {
    date: string | Date;
    [key: string]: any;
}

interface InteractiveAreaChartProps {
    data: DataItem[];
    dataKey: string;
    color: string;
    height?: number;
    formatter?: (value: number) => string;
    name?: string;
}

export function InteractiveAreaChart({
    data,
    dataKey,
    color,
    height = 300,
    formatter,
    name = "Value"
}: InteractiveAreaChartProps) {
    const gradientId = `fill-${dataKey}`;

    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(date) => format(new Date(date), 'MMM d')}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace' }}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                        minTickGap={24}
                    />
                    <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatter}
                        width={58}
                    />
                    <Tooltip
                        content={<ChartTooltip formatter={formatter} />}
                        cursor={{ stroke: 'hsl(var(--border-strong))', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Area
                        type="monotone"
                        dataKey={dataKey}
                        name={name}
                        stroke={color}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#${gradientId})`}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))', fill: color }}
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
