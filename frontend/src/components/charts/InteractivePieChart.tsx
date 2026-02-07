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

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;

    return (
        <g>
            <text x={cx} y={cy} dy={-20} textAnchor="middle" fill="#9ca3af" fontSize={12}>
                {payload.name}
            </text>
            <text x={cx} y={cy} dy={10} textAnchor="middle" fill="#f3f4f6" fontSize={16} fontWeight="bold">
                {props.formatter ? props.formatter(value) : value}
            </text>
            <text x={cx} y={cy} dy={30} textAnchor="middle" fill="#6b7280" fontSize={12}>
                {`(${(percent * 100).toFixed(1)}%)`}
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                className="drop-shadow-lg transition-all duration-300"
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 8}
                outerRadius={outerRadius + 12}
                fill={fill}
                opacity={0.3}
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
    colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'],
    centerText,
    formatter
}: InteractivePieChartProps) {
    const [activeIndex, setActiveIndex] = useState(0);

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    const handleClick = (data: any, index: number) => {
        setActiveIndex(index);
        onSliceClick?.(data);
    };

    return (
        <div style={{ width: '100%', height }}>
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
                        dataKey="value"
                        onMouseEnter={onPieEnter}
                        onClick={handleClick}
                        className="cursor-pointer focus:outline-none"
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color || colors[index % colors.length]}
                                strokeWidth={2}
                                stroke="rgba(0,0,0,0.2)"
                            />
                        ))}
                    </Pie>
                    {!centerText && (
                        <Tooltip
                            content={<ChartTooltip formatter={formatter} hideLabel />}
                            wrapperStyle={{ outline: 'none' }}
                        />
                    )}
                    {centerText && activeIndex === -1 && (
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                            <tspan x="50%" dy="-10" fontSize="14" fill="#9ca3af">{centerText.title}</tspan>
                            <tspan x="50%" dy="24" fontSize="20" fontWeight="bold" fill="#f3f4f6">{centerText.value}</tspan>
                        </text>
                    )}
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
