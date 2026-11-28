import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { formatCurrency } from '../lib/format';

export type AreaPoint = { value: number; label?: string };

type Props = {
    data: AreaPoint[];
    width: number;
    height: number;
    isDark: boolean;
};

const PAD_LEFT = 46;
const PAD_RIGHT = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

const compactNumber = new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 0,
});

export default function NetWorthAreaChart({ data, width, height, isDark }: Props) {
    const accent = isDark ? '#8b8dff' : '#4f46e5';
    const grid = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';
    const axis = isDark ? '#a0a8be' : '#475569';

    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;
    const innerW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
    const innerH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
    const px = (i: number) => PAD_LEFT + (i / Math.max(1, data.length - 1)) * innerW;
    const py = (v: number) => PAD_TOP + innerH - ((v - min) / span) * innerH;

    const line = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`)
        .join(' ');
    const lastIndex = data.length - 1;
    const area = `${line} L${px(lastIndex).toFixed(1)},${(PAD_TOP + innerH).toFixed(1)} L${PAD_LEFT},${(PAD_TOP + innerH).toFixed(1)} Z`;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + span * t);
    const labelIndexes = Array.from(
        new Set([0, Math.floor(lastIndex / 2), lastIndex].filter((i) => i >= 0))
    );

    return (
        <View style={{ width, height }} accessibilityRole="image" accessibilityLabel="Net worth growth chart">
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={accent} stopOpacity={0.32} />
                        <Stop offset="1" stopColor={accent} stopOpacity={0.02} />
                    </LinearGradient>
                </Defs>
                {ticks.map((tick, index) => {
                    const yLine = py(tick);
                    return (
                        <Line
                            key={`grid-${index}`}
                            x1={PAD_LEFT}
                            y1={yLine}
                            x2={PAD_LEFT + innerW}
                            y2={yLine}
                            stroke={grid}
                            strokeWidth={1}
                        />
                    );
                })}
                <Path d={area} fill="url(#netWorthFill)" />
                <Path d={line} stroke={accent} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <Circle cx={px(lastIndex)} cy={py(values[lastIndex])} r={4} fill={accent} />
            </Svg>

            {ticks.map((tick, index) => (
                <Text
                    key={`tick-${index}`}
                    style={[styles.yLabel, { color: axis, top: py(tick) - 7 }]}
                    numberOfLines={1}
                >
                    {compactNumber.format(Math.round(tick))}
                </Text>
            ))}

            {labelIndexes.map((i) => (
                <Text
                    key={`x-${i}`}
                    style={[
                        styles.xLabel,
                        {
                            color: axis,
                            left: Math.min(Math.max(0, px(i) - 14), width - 28),
                            top: PAD_TOP + innerH + 4,
                        },
                    ]}
                >
                    {data[i].label ?? ''}
                </Text>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    yLabel: { position: 'absolute', left: 0, width: PAD_LEFT - 6, fontSize: 10, textAlign: 'right' },
    xLabel: { position: 'absolute', width: 28, fontSize: 10, textAlign: 'center' },
});
