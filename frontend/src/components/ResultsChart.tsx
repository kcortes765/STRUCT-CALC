"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from "recharts";

interface DiagramPoint {
    x: number;
    value: number;
}

interface ResultsChartProps {
    data: DiagramPoint[];
    color: string;
    label: string;
    showZeroLine?: boolean;
}

export default function ResultsChart({
    data,
    color,
    label,
    showZeroLine = true
}: ResultsChartProps) {
    // Find min and max for proper scaling
    const values = data.map(d => d.value);
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 0);
    const padding = Math.abs(maxValue - minValue) * 0.1 || 10;

    return (
        <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(71, 85, 105, 0.3)"
                        vertical={false}
                    />

                    <XAxis
                        dataKey="x"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#475569" }}
                        tickFormatter={(value) => `${value.toFixed(1)}`}
                        label={{
                            value: "x (m)",
                            position: "insideBottomRight",
                            offset: -5,
                            fill: "#64748b",
                            fontSize: 10
                        }}
                    />

                    <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#475569" }}
                        domain={[minValue - padding, maxValue + padding]}
                        tickFormatter={(value) => value.toFixed(1)}
                        width={50}
                    />

                    {showZeroLine && (
                        <ReferenceLine
                            y={0}
                            stroke="#475569"
                            strokeWidth={1}
                        />
                    )}

                    <Tooltip
                        contentStyle={{
                            backgroundColor: "rgba(30, 41, 59, 0.95)",
                            border: "1px solid rgba(71, 85, 105, 0.5)",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                        }}
                        labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                        itemStyle={{ color: color }}
                        formatter={(value: number) => [value.toFixed(2), label]}
                        labelFormatter={(x) => `x = ${Number(x).toFixed(2)} m`}
                    />

                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#gradient-${color.replace('#', '')})`}
                        dot={false}
                        activeDot={{
                            r: 4,
                            fill: color,
                            stroke: "#1e293b",
                            strokeWidth: 2
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex justify-center mt-2">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                </div>
            </div>
        </div>
    );
}
