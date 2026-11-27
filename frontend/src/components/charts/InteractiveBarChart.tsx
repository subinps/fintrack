import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface DataItem {
    name: string;
    [key: string]: any;
}

interface InteractiveBarChartProps {
    data: DataItem[];
    bars: {
        key: string;
        name: string;
        color: string;
        stackId?: string;
        isActive?: boolean;
    }[];
    onBarClick?: (data: DataItem) => void;
    height?: number;
    formatter?: (value: number) => string;
    xAxisKey?: string;
}

export function InteractiveBarChart({
    data,
    bars,
    onBarClick,
    height = 300,
    formatter,
    xAxisKey = "name"
}: InteractiveBarChartProps) {
    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer>
                <BarChart data={data} onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                        onBarClick?.(state.activePayload[0].payload);
                    }
                }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey={xAxisKey}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace' }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        minTickGap={16}
                    />
                    <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatter}
                        width={78}
                    />
                    <Tooltip
                        content={<ChartTooltip formatter={formatter} />}
                        cursor={{ fill: 'hsl(var(--muted-foreground))', opacity: 0.12 }}
                    />
                    {bars.map((bar) => (
                        <Bar
                            key={bar.key}
                            dataKey={bar.key}
                            name={bar.name}
                            fill={bar.color}
                            radius={[4, 4, 0, 0]}
                            stackId={bar.stackId}
                            className={`
                                cursor-pointer hover:opacity-80 transition-opacity
                                ${bar.isActive ? 'pill-glow' : ''}
                                ${bar.isActive ? 'animate-pulse-subtle' : ''}
                            `}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
