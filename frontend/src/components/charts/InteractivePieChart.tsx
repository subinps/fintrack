import { useState } from 'react';
import { PieChart, Pie, Sector, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface DataItem {
    name: string;
    value: number;
    color?: string;
    [key: string]: any;
}

interface InteractivePieChartProps {
    data: DataItem[];
    onSliceClick?: (item: DataItem) => void;
    height?: number;
    innerRadius?: number;
    outerRadius?: number;
    colors?: string[];
    centerText?: {
        title: string;
        value: string;
    };
    formatter?: (value: number) => string;
}

const MONO = 'JetBrains Mono Variable, monospace';

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;

    return (
        <g>
            <text x={cx} y={cy} dy={-18} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10.5} fontFamily={MONO} letterSpacing="0.12em">
                {String(payload.name).toUpperCase()}
            </text>
            <text x={cx} y={cy} dy={8} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={16} fontWeight="600" fontFamily={MONO}>
                {props.formatter ? props.formatter(value) : value}
            </text>
            <text x={cx} y={cy} dy={28} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11} fontFamily={MONO}>
                {`${(percent * 100).toFixed(1)}%`}
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                cornerRadius={4}
                className="drop-shadow-lg"
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 9}
                outerRadius={outerRadius + 12}
                fill={fill}
                opacity={0.35}
                cornerRadius={4}
            />
        </g>
    );
};

export function InteractivePieChart({
    data,
    onSliceClick,
    height = 300,
    innerRadius = 60,
    outerRadius = 80,
    colors = [
        'hsl(var(--chart-1))',
        'hsl(var(--chart-2))',
        'hsl(var(--chart-3))',
        'hsl(var(--chart-4))',
        'hsl(var(--chart-5))',
        'hsl(var(--chart-6))',
        'hsl(var(--chart-7))',
        'hsl(var(--chart-8))',
    ],
    centerText,
    formatter
}: InteractivePieChartProps) {
    const [activeIndex, setActiveIndex] = useState(-1);

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    const handleClick = (entry: any, index: number) => {
        setActiveIndex(index);
        onSliceClick?.(entry);
    };

    return (
        <div className="relative" style={{ width: '100%', height }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        activeIndex={activeIndex}
                        activeShape={(props: any) => renderActiveShape({ ...props, formatter })}
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        paddingAngle={2}
                        cornerRadius={4}
                        dataKey="value"
                        onMouseEnter={onPieEnter}
                        onMouseLeave={() => setActiveIndex(-1)}
                        onClick={handleClick}
                        animationDuration={650}
                        animationEasing="ease-out"
                        className="cursor-pointer"
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color || colors[index % colors.length]}
                                strokeWidth={2}
                                stroke="hsl(var(--card))"
                            />
                        ))}
                    </Pie>
                    {!centerText && (
                        <Tooltip
                            content={<ChartTooltip formatter={formatter} hideLabel />}
                            wrapperStyle={{ outline: 'none' }}
                        />
                    )}
                </PieChart>
            </ResponsiveContainer>
            {centerText && activeIndex === -1 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="eyebrow text-muted-foreground">{centerText.title}</span>
                    <span className="tabular mt-1 text-title font-semibold text-foreground">{centerText.value}</span>
                </div>
            )}
        </div>
    );
}
