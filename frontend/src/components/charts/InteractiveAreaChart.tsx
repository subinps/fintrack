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
    const gradientId = `color-${dataKey}`;

    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.5} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(date) => format(new Date(date), 'MMM d')}
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
                        cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Area
                        type="monotone"
                        dataKey={dataKey}
                        name={name}
                        stroke={color}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill={`url(#${gradientId})`}
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
