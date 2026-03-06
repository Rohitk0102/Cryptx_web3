import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export function Button({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading,
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";

    const variants = {
        primary: "bg-[#00FFB2] text-black hover:scale-105 hover:shadow-[0_0_34px_0_rgba(42,240,124,0.4)] shadow-[0_0_34px_0_rgba(42,240,124,0.3)]",
        secondary: "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20",
        outline: "border border-white/20 text-[#F5F5F5] hover:bg-white/5 bg-transparent",
        ghost: "text-[#D5D5D5] hover:text-[#F5F5F5] hover:bg-white/5",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-6 py-2.5 text-sm",
        lg: "px-8 py-3.5 text-base",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading ? (
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Loading...</span>
                </div>
            ) : children}
        </button>
    );
}
