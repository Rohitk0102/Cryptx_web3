'use client';

import { Card } from '@/components/ui/Card';

interface PerformanceMetrics {
    change24h: number;
    change7d: number;
    change30d: number;
    changeAll: number;
    highestValue?: number;
    lowestValue?: number;
}

export function PerformanceMetrics({ metrics }: { metrics: PerformanceMetrics }) {
    const formatChange = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    const getChangeColor = (value: number) => {
        return value >= 0 ? 'text-success' : 'text-error';
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
                <div className="text-xs text-text-secondary mb-1 uppercase tracking-wide font-medium">24h Change</div>
                <div className={`text-2xl font-bold ${getChangeColor(metrics.change24h)}`}>
                    {formatChange(metrics.change24h)}
                </div>
            </Card>

            <Card className="p-4">
                <div className="text-xs text-text-secondary mb-1 uppercase tracking-wide font-medium">7d Change</div>
                <div className={`text-2xl font-bold ${getChangeColor(metrics.change7d)}`}>
                    {formatChange(metrics.change7d)}
                </div>
            </Card>

            <Card className="p-4">
                <div className="text-xs text-text-secondary mb-1 uppercase tracking-wide font-medium">30d Change</div>
                <div className={`text-2xl font-bold ${getChangeColor(metrics.change30d)}`}>
                    {formatChange(metrics.change30d)}
                </div>
            </Card>

            <Card className="p-4">
                <div className="text-xs text-text-secondary mb-1 uppercase tracking-wide font-medium">All Time</div>
                <div className={`text-2xl font-bold ${getChangeColor(metrics.changeAll)}`}>
                    {formatChange(metrics.changeAll)}
                </div>
            </Card>
        </div>
    );
}
