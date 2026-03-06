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
