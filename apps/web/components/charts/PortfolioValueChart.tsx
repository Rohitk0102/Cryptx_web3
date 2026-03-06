'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { formatUSDAsINR, usdToInr } from '@/lib/currency';

interface HistoricalValue {
    date: string;
    value: number;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-surface-elevated border border-border p-3 rounded-[2px]">
                <p className="text-xs text-text-secondary mb-1">
                    {label && format(new Date(label), 'MMM dd, yyyy')}
                </p>
                <p className="text-text-primary font-semibold">
                    {formatUSDAsINR(payload[0].value)}
                </p>
            </div>
        );
    }
    return null;
};

export function PortfolioValueChart({ data }: { data: HistoricalValue[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] flex items-center justify-center text-text-secondary">
                <p>No historical data available</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                    dataKey="date"
                    stroke="var(--text-secondary)"
                    fontSize={12}
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis
                    stroke="var(--text-secondary)"
                    fontSize={12}
                    tickFormatter={(value) => `₹${(usdToInr(value) / 1000).toFixed(0)}K`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--accent)" }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
