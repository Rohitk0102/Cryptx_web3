import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function Button({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading,
    disabled,
    leftIcon,
    rightIcon,
    ...props
}: ButtonProps) {
    const baseStyles = "inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";

    const variants = {
        primary: "btn-brand-solid",
        secondary: "bg-white/[0.04] text-white border border-white/10 hover:bg-white/[0.08] hover:border-white/20",
        outline: "border border-white/20 text-[#F5F5F5] hover:bg-white/5 bg-transparent",
        ghost: "text-[#D5D5D5] hover:text-[#F5F5F5] hover:bg-white/5",
        danger: "bg-[#FF4C4C]/10 text-[#FF4C4C] border border-[#FF4C4C]/30 hover:bg-[#FF4C4C]/20",
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
            ) : (
                <div className="flex items-center">
                    {leftIcon && <span className="mr-2">{leftIcon}</span>}
                    {children}
                    {rightIcon && <span className="ml-2">{rightIcon}</span>}
                </div>
            )}
        </button>
    );
}
