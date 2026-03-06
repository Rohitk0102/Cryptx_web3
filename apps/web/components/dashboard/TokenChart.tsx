'use client';

import { useState, useRef, useEffect } from 'react';

interface TokenChartProps {
    data: Array<[number, number]>; // [timestamp, price]
    isPositive: boolean;
    timeRange: string;
}

export default function TokenChart({ data, isPositive, timeRange }: TokenChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{ price: number; date: Date; x: number; y: number } | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 400 });

    useEffect(() => {
        const updateDimensions = () => {
            if (canvasRef.current?.parentElement) {
                const width = canvasRef.current.parentElement.clientWidth;
                setDimensions({ width, height: 400 });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        if (!canvasRef.current || !data || data.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = dimensions.width * 2; // 2x for retina
        canvas.height = dimensions.height * 2;
        ctx.scale(2, 2);

        // Clear canvas
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);

        // Calculate bounds
        const prices = data.map(d => d[1]);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartWidth = dimensions.width - padding.left - padding.right;
        const chartHeight = dimensions.height - padding.top - padding.bottom;

        // Helper functions
        const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
        const getY = (price: number) => padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

        // Draw grid lines
        ctx.strokeStyle = '#D1D1D1'; // --border color
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (i / 4) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(dimensions.width - padding.right, y);
            ctx.stroke();

            // Price labels
            const price = maxPrice - (i / 4) * priceRange;
            ctx.fillStyle = '#4A4A4A'; // --text-secondary color
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`$${price.toFixed(2)}`, padding.left - 10, y + 4);
        }

        // Draw area fill with neutral opacity
        const fillColor = isPositive ? 'rgba(46, 125, 50, 0.1)' : 'rgba(220, 20, 60, 0.1)'; // success/error with opacity

        ctx.beginPath();
        ctx.moveTo(getX(0), dimensions.height - padding.bottom);
        data.forEach((point, index) => {
            ctx.lineTo(getX(index), getY(point[1]));
        });
        ctx.lineTo(getX(data.length - 1), dimensions.height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(data[0][1]));
        data.forEach((point, index) => {
            ctx.lineTo(getX(index), getY(point[1]));
        });
        ctx.strokeStyle = isPositive ? '#2E7D32' : '#DC143C'; // --semantic-success / --semantic-error
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw hover point
        if (hoveredPoint) {
            ctx.beginPath();
            ctx.arc(hoveredPoint.x, hoveredPoint.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#0047AB'; // --accent color
            ctx.fill();
            ctx.strokeStyle = '#F5F5F0'; // --background color
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw vertical line
            ctx.beginPath();
            ctx.moveTo(hoveredPoint.x, padding.top);
            ctx.lineTo(hoveredPoint.x, dimensions.height - padding.bottom);
            ctx.strokeStyle = '#D1D1D1'; // --border color
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw time labels
        const timeLabels = 5;
        ctx.fillStyle = '#4A4A4A'; // --text-secondary color
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < timeLabels; i++) {
            const index = Math.floor((i / (timeLabels - 1)) * (data.length - 1));
            const x = getX(index);
            const date = new Date(data[index][0]);
            let label = '';

            if (timeRange === '1') {
                label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (timeRange === '7') {
                label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            } else {
                label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }

            ctx.fillText(label, x, dimensions.height - padding.bottom + 20);
        }
    }, [data, dimensions, hoveredPoint, isPositive, timeRange]);

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !data) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartWidth = dimensions.width - padding.left - padding.right;

        if (x < padding.left || x > dimensions.width - padding.right) {
            setHoveredPoint(null);
            return;
        }

        const index = Math.round(((x - padding.left) / chartWidth) * (data.length - 1));
        if (index >= 0 && index < data.length) {
            const point = data[index];
            const prices = data.map(d => d[1]);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const priceRange = maxPrice - minPrice;
            const chartHeight = dimensions.height - padding.top - padding.bottom;

            const pointX = padding.left + (index / (data.length - 1)) * chartWidth;
            const pointY = padding.top + chartHeight - ((point[1] - minPrice) / priceRange) * chartHeight;

            setHoveredPoint({
                price: point[1],
                date: new Date(point[0]),
                x: pointX,
                y: pointY
            });
        }
    };

    const handleMouseLeave = () => {
        setHoveredPoint(null);
    };

    const formatPrice = (price: number) => {
        if (price < 0.01) return `$${price.toFixed(6)}`;
        if (price < 1) return `$${price.toFixed(4)}`;
        return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="relative">
            {hoveredPoint && (
                <div className="absolute top-0 left-0 bg-surface border border-border rounded-[2px] px-4 py-2 pointer-events-none z-10">
                    <div className="text-text-primary font-semibold text-lg">{formatPrice(hoveredPoint.price)}</div>
                    <div className="text-text-secondary text-xs">
                        {hoveredPoint.date.toLocaleString()}
                    </div>
                </div>
            )}
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="cursor-crosshair"
                style={{ width: dimensions.width, height: dimensions.height }}
            />
        </div>
    );
}
