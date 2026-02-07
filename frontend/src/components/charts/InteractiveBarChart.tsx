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
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.5} />
                    <XAxis
                        dataKey={xAxisKey}
                        stroke="#9ca3af"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis
                        stroke="#9ca3af"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatter}
                        dx={-10}
                    />
                    <Tooltip
                        content={<ChartTooltip formatter={formatter} />}
                        cursor={{ fill: '#374151', opacity: 0.2 }}
                    />
                    {bars.map((bar) => (
                        <Bar
                            key={bar.key}
                            dataKey={bar.key}
                            name={bar.name}
                            fill={bar.color}
                            radius={[4, 4, 0, 0]}
                            stackId={bar.stackId}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
