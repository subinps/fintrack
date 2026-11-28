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

const AXIS_TICK = {
    fill: 'hsl(var(--muted-foreground))',
    fontSize: 11,
    fontFamily: 'JetBrains Mono Variable, monospace',
};

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
                <BarChart
                    data={data}
                    barGap={4}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    onClick={(state) => {
                        if (state && state.activePayload && state.activePayload.length > 0) {
                            onBarClick?.(state.activePayload[0].payload);
                        }
                    }}
                >
                    <defs>
                        {bars.map((bar) => (
                            <linearGradient key={`grad-${bar.key}`} id={`bar-${bar.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={bar.color} stopOpacity={1} />
                                <stop offset="100%" stopColor={bar.color} stopOpacity={0.55} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey={xAxisKey}
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        minTickGap={16}
                    />
                    <YAxis
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatter}
                        width={72}
                    />
                    <Tooltip
                        content={<ChartTooltip formatter={formatter} />}
                        cursor={{ fill: 'hsl(var(--muted-foreground))', opacity: 0.08, radius: 8 }}
                    />
                    {bars.map((bar) => (
                        <Bar
                            key={bar.key}
                            dataKey={bar.key}
                            name={bar.name}
                            fill={`url(#bar-${bar.key})`}
                            stroke={bar.color}
                            strokeOpacity={0.35}
                            radius={[6, 6, 2, 2]}
                            maxBarSize={54}
                            stackId={bar.stackId}
                            animationDuration={600}
                            animationEasing="ease-out"
                            className={`
                                cursor-pointer transition-opacity duration-feedback ease-vault hover:opacity-85
                                ${bar.isActive ? 'animate-pulse-subtle' : ''}
                            `}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
