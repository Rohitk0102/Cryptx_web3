import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={`
                bg-white/[0.03] border border-white/10 rounded-2xl p-6 relative overflow-hidden
                transition-all duration-300
                ${hover ? 'cursor-pointer hover:bg-white/[0.06] hover:border-white/20' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <h3 className={`text-lg font-semibold text-[#F5F5F5] mb-2 ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <p className={`text-[#D5D5D5] text-sm leading-relaxed ${className}`}>{children}</p>;
}

// ─── StatCard Component ─────────────────────────────────────────────────────
interface StatCardProps {
    label: string;
    value: string;
    change?: string;         // e.g. "+12.4%"
    changeDirection?: 'up' | 'down' | 'neutral';
    icon?: React.ReactNode;
    accent?: boolean;        // if true: glowing border in value direction color
    loading?: boolean;       // shows shimmer skeleton
    className?: string;
}

export function StatCard({ 
    label, 
    value, 
    change, 
    changeDirection = 'neutral', 
    icon, 
    accent = false, 
    loading = false,
    className = ''
}: StatCardProps) {
    const getChangeColor = () => {
        switch (changeDirection) {
            case 'up': return 'text-[#00FFB2] bg-[#00FFB2]/10';
            case 'down': return 'text-[#FF4C4C] bg-[#FF4C4C]/10';
            default: return 'text-[#D5D5D5] bg-white/10';
        }
    };

    const getAccentBorder = () => {
        if (!accent) return '';
        switch (changeDirection) {
            case 'up': return 'border-l-4 border-l-[#00FFB2] shadow-lg shadow-[#00FFB2]/20';
            case 'down': return 'border-l-4 border-l-[#FF4C4C] shadow-lg shadow-[#FF4C4C]/20';
            default: return 'border-l-4 border-l-[#D5D5D5]/30';
        }
    };

    if (loading) {
        return (
            <div className={`bg-white/[0.03] border border-white/10 rounded-2xl p-6 ${getAccentBorder()} ${className}`}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
                        {icon && <div className="h-6 w-6 bg-white/[0.06] rounded animate-pulse" />}
                    </div>
                    <div className="h-8 w-24 bg-white/[0.06] rounded animate-pulse" />
                    {change && <div className="h-5 w-16 bg-white/[0.06] rounded-full animate-pulse" />}
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white/[0.03] border border-white/10 rounded-2xl p-6 transition-all duration-200 hover:bg-white/[0.05] ${getAccentBorder()} ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-medium text-[#D5D5D5]/60 uppercase tracking-wider">
                    {label}
                </div>
                {icon && (
                    <div className="text-[#D5D5D5]/60">
                        {icon}
                    </div>
                )}
            </div>
            
            <div className="text-2xl font-bold text-[#F5F5F5] mb-2">
                {value}
            </div>
            
            {change && (
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getChangeColor()}`}>
                    {changeDirection === 'up' && '↗'}
                    {changeDirection === 'down' && '↘'}
                    {change}
                </div>
            )}
        </div>
    );
}

// ─── SkeletonCard Component ─────────────────────────────────────────────────
interface SkeletonCardProps {
    lines?: number;     // number of skeleton lines (default 3)
    height?: string;    // card height (default 'h-32')
    className?: string;
}

export function SkeletonCard({ lines = 3, height = 'h-32', className = '' }: SkeletonCardProps) {
    return (
        <div className={`bg-white/[0.03] border border-white/10 rounded-2xl p-6 ${height} ${className}`}>
            <div className="space-y-3">
                {Array.from({ length: lines }).map((_, i) => (
                    <div key={i} className="relative overflow-hidden">
                        <div className={`h-4 bg-white/[0.06] rounded ${i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── EmptyState Component ───────────────────────────────────────────────────
interface EmptyStateProps {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void; };
    icon?: React.ReactNode;
    className?: string;
}

export function EmptyState({ title, description, action, icon, className = '' }: EmptyStateProps) {
    return (
        <div className={`text-center py-12 ${className}`}>
            {icon && (
                <div className="mb-6 flex justify-center">
                    <div className="text-[#D5D5D5]/30">
                        {icon}
                    </div>
                </div>
            )}
            
            <h3 className="text-lg font-semibold text-[#F5F5F5] mb-2">
                {title}
            </h3>
            
            <p className="text-[#D5D5D5]/60 mb-6 max-w-md mx-auto leading-relaxed">
                {description}
            </p>
            
            {action && (
                <button
                    onClick={action.onClick}
                    className="btn-brand-solid inline-flex items-center rounded-lg px-4 py-2 font-medium"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
