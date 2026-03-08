'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;  // ms, default 4000
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type: Toast['type'], duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: Toast['type'], duration = 4000) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast: Toast = { id, message, type, duration };
        
        setToasts(prev => {
            const updated = [...prev, newToast];
            // Keep max 4 toasts, remove oldest first
            return updated.length > 4 ? updated.slice(-4) : updated;
        });

        // Auto-dismiss after duration
        setTimeout(() => {
            removeToast(id);
        }, duration);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <ToastContainer />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return { showToast: context.showToast };
}

function ToastContainer() {
    const context = useContext(ToastContext);
    if (!context) return null;

    const { toasts, removeToast } = context;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
}

interface ToastItemProps {
    toast: Toast;
    onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
    const [progress, setProgress] = useState(100);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Slide in animation
        setTimeout(() => setIsVisible(true), 10);

        // Progress bar animation
        const duration = toast.duration || 4000;
        const interval = 50; // Update every 50ms
        const decrement = (100 / duration) * interval;

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev - decrement;
                return newProgress <= 0 ? 0 : newProgress;
            });
        }, interval);

        return () => clearInterval(progressInterval);
    }, [toast.duration]);

    const getToastStyles = () => {
        const baseStyles = "relative bg-[#0E0D18] border rounded-lg p-4 shadow-lg backdrop-blur-sm min-w-[300px] max-w-[400px]";
        
        switch (toast.type) {
            case 'success':
                return `${baseStyles} border-[#00FFB2]/30 shadow-[#00FFB2]/20`;
            case 'error':
                return `${baseStyles} border-[#FF4C4C]/30 shadow-[#FF4C4C]/20`;
            case 'warning':
                return `${baseStyles} border-[#F59E0B]/30 shadow-[#F59E0B]/20`;
            case 'info':
                return `${baseStyles} border-[#60A5FA]/30 shadow-[#60A5FA]/20`;
            default:
                return `${baseStyles} border-white/10`;
        }
    };

    const getIconColor = () => {
        switch (toast.type) {
            case 'success': return '#00FFB2';
            case 'error': return '#FF4C4C';
            case 'warning': return '#F59E0B';
            case 'info': return '#60A5FA';
            default: return '#D5D5D5';
        }
    };

    const getProgressBarColor = () => {
        switch (toast.type) {
            case 'success': return 'bg-[#00FFB2]';
            case 'error': return 'bg-[#FF4C4C]';
            case 'warning': return 'bg-[#F59E0B]';
            case 'info': return 'bg-[#60A5FA]';
            default: return 'bg-white/20';
        }
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                );
            case 'error':
                return (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                );
            case 'info':
                return (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div
            className={`
                ${getToastStyles()}
                transform transition-all duration-300 ease-out
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
        >
            <div className="flex items-start gap-3">
                <div style={{ color: getIconColor() }}>
                    {getIcon()}
                </div>
                
                <div className="flex-1 text-sm text-[#F5F5F5] leading-relaxed">
                    {toast.message}
                </div>
                
                <button
                    onClick={() => onRemove(toast.id)}
                    className="text-[#D5D5D5]/60 hover:text-[#F5F5F5] transition-colors"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-b-lg overflow-hidden">
                <div
                    className={`h-full transition-all duration-75 ease-linear ${getProgressBarColor()}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}

export { ToastContainer };