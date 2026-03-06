/**
 * @deprecated This Zustand auth store uses the legacy SIWE/JWT authentication system.
 * 
 * The application now uses Clerk for authentication. This store is kept for:
 * 1. Legacy code compatibility (useWalletConnect hook)
 * 2. Reference during migration
 * 
 * Do NOT use this store in new code. Instead:
 * - Use @clerk/nextjs hooks (useUser, useAuth) for auth state
 * - Use ClerkAuthSync component to sync with API client
 * - Use setClerkAuth/setClerkTokenGetter from lib/api.ts for API authentication
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
    id: string;
    address: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    accessToken: string | null;
    refreshToken: string | null;
    _hasHydrated: boolean;

    setAuth: (tokens: { accessToken: string; refreshToken: string }, user: User) => void;
    clearAuth: () => void;
    setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            _hasHydrated: false,

            setAuth: (tokens, user) => {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('accessToken', tokens.accessToken);
                    localStorage.setItem('refreshToken', tokens.refreshToken);
                }
                set({
                    user,
                    isAuthenticated: true,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                });
            },

            clearAuth: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                }
                set({
                    user: null,
                    isAuthenticated: false,
                    accessToken: null,
                    refreshToken: null,
                });
            },

            setHasHydrated: (state) => {
                set({
                    _hasHydrated: state,
                });
            },
        }),
        {
            name: 'auth-storage',
            version: 1, // Add version to force migration
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
            migrate: (persistedState: any, version: number) => {
                // Migrate old state to new structure
                if (version === 0) {
                    // Load tokens from localStorage if they exist
                    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
                    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
                    
                    return {
                        ...persistedState,
                        accessToken,
                        refreshToken,
                        _hasHydrated: false,
                    };
                }
                return persistedState;
            },
        }
    )
);
