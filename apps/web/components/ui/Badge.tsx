import React from 'react';

interface BadgeProps {
    label: string;
    color: 'green' | 'red' | 'blue' | 'amber' | 'gray';
    size?: 'sm' | 'md';
    className?: string;
}

export function Badge({ label, color, size = 'md', className = '' }: BadgeProps) {
    const getColorStyles = () => {
        switch (color) {
            case 'green':
                return 'bg-[#00FFB2]/10 text-[#00FFB2] border-[#00FFB2]/20';
            case 'red':
                return 'bg-[#FF4C4C]/10 text-[#FF4C4C] border-[#FF4C4C]/20';
            case 'blue':
                return 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20';
            case 'amber':
                return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20';
            case 'gray':
                return 'bg-white/10 text-[#D5D5D5] border-white/20';
            default:
                return 'bg-white/10 text-[#D5D5D5] border-white/20';
        }
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return 'text-xs px-2 py-0.5';
            case 'md':
                return 'text-sm px-3 py-1';
            default:
                return 'text-sm px-3 py-1';
        }
    };

    return (
        <span
            className={`
                inline-flex items-center font-medium rounded-full border
                ${getColorStyles()}
                ${getSizeStyles()}
                ${className}
            `}
        >
            {label}
        </span>
    );
}