'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatUSDAsINR, usdToInr } from '@/lib/currency';

interface AssetAllocation {
    symbol: string;
    name: string;
    value: number;
    percentage: number;
}

// Neutral grayscale colors for Swiss design
const COLORS = ['#1A1A1A', '#424242', '#666666', '#8E8E8E', '#B0B0B0', '#D4D4D4', '#E8E8E8'];

interface CustomTooltipProps {
    active?: boolean;
    payload?: any[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-surface-elevated border border-border p-3 rounded-[2px]">
                <p className="text-text-primary font-semibold text-sm">{data.symbol}</p>
                <p className="text-xs text-text-secondary">{data.name}</p>
                <p className="text-text-primary font-medium mt-1">
                    {formatUSDAsINR(data.value)}
                </p>
                <p className="text-xs text-text-secondary">
                    {data.percentage.toFixed(2)}%
                </p>
            </div>
        );
    }
    return null;
};

export function AssetAllocationPie({ data }: { data: AssetAllocation[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] flex items-center justify-center text-text-secondary">
                <p>No assets to display</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={(props: any) => `${props.symbol} ${props.percentage.toFixed(1)}%`}
                    labelLine={{ stroke: 'var(--text-secondary)', strokeWidth: 1 }}
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                        />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => (
                        <span className="text-text-secondary text-xs">{entry.payload.symbol}</span>
                    )}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
