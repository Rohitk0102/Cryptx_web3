import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

// Debug: Log the API base URL
if (typeof window !== 'undefined') {
    console.log('🌐 API Base URL:', API_BASE_URL);
    console.log('🌐 NEXT_PUBLIC_API_URL env:', process.env.NEXT_PUBLIC_API_URL);
}

// Store for Clerk auth data - can be set from components
let clerkToken: string | null = null;
let clerkUserId: string | null = null;
let getClerkTokenFn: (() => Promise<string | null>) | null = null;

export const setClerkAuth = (token: string | null, userId: string | null) => {
    clerkToken = token;
    clerkUserId = userId;
};

export const setClerkTokenGetter = (getter: () => Promise<string | null>, userId: string) => {
    getClerkTokenFn = getter;
    clerkUserId = userId;
};

export const clearClerkAuth = () => {
    clerkToken = null;
    clerkUserId = null;
    getClerkTokenFn = null;

    // Clear any cached data on logout
    if (typeof window !== 'undefined') {
        // Dispatch a custom event to notify components to clear their caches
        window.dispatchEvent(new CustomEvent('auth-cleared'));
    }
};

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};

    if (getClerkTokenFn && clerkUserId) {
        try {
            const freshToken = await getClerkTokenFn();
            if (freshToken) {
                headers.Authorization = `Bearer ${freshToken}`;
                headers['X-Clerk-User-Id'] = clerkUserId;
                return headers;
            }
        } catch (error) {
            console.error('Failed to get fresh Clerk token for stream:', error);
        }
    }

    if (clerkToken) {
        headers.Authorization = `Bearer ${clerkToken}`;
        if (clerkUserId) {
            headers['X-Clerk-User-Id'] = clerkUserId;
        }
        return headers;
    }

    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        if (token) {
            headers.Authorization = `Bearer ${token}`;
            return headers;
        }
    }

    return headers;
};

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
    // Try to get fresh Clerk token if getter is available
    if (getClerkTokenFn && clerkUserId) {
        try {
            const freshToken = await getClerkTokenFn();
            if (freshToken) {
                config.headers.Authorization = `Bearer ${freshToken}`;
                config.headers['X-Clerk-User-Id'] = clerkUserId;
                return config;
            }
        } catch (e) {
            console.error('Failed to get fresh Clerk token:', e);
        }
    }

    // Fallback to cached Clerk token if available
    if (clerkToken) {
        config.headers.Authorization = `Bearer ${clerkToken}`;
        if (clerkUserId) {
            config.headers['X-Clerk-User-Id'] = clerkUserId;
        }
        return config;
    }

    // Fallback to legacy localStorage token
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            return config;
        }
    }

    // If we reach here, no authentication is available
    console.warn('⚠️  No authentication token available for API request');
    return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Don't try to refresh token for auth endpoints to avoid infinite loops
        const isAuthEndpoint = originalRequest.url?.includes('/auth/');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true;

            // If using Clerk auth, don't try to refresh with legacy tokens
            if (getClerkTokenFn) {
                console.warn('⚠️  Clerk token expired or invalid - user may need to re-authenticate');
                return Promise.reject(error);
            }

            try {
                // All localStorage access must be guarded for Next.js SSR safety
                if (typeof window === 'undefined') {
                    return Promise.reject(error);
                }

                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) {
                    console.warn('⚠️  No refresh token available - user needs to login');
                    // Don't redirect here, just reject the request
                    // This allows the calling code to handle the error appropriately
                    return Promise.reject(error);
                }

                console.log('🔄 Attempting to refresh token...');
                const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refreshToken,
                });

                localStorage.setItem('accessToken', data.accessToken);
                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

                console.log('✅ Token refreshed, retrying original request');
                return apiClient(originalRequest);
            } catch (refreshError) {
                // Refresh failed, logout
                console.error('❌ Token refresh failed:', refreshError);

                if (typeof window !== 'undefined') {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');

                    // Only redirect if we're not already on the home page
                    if (window.location.pathname !== '/') {
                        console.log('🔄 Redirecting to home page...');
                        window.location.href = '/';
                    }
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        address: string;
    };
}

export const authApi = {
    getNonce: async (): Promise<{ nonce: string }> => {
        const { data } = await apiClient.post('/auth/nonce');
        return data;
    },

    verifySignature: async (
        message: string,
        signature: string,
        provider?: string
    ): Promise<AuthResponse> => {
        const { data } = await apiClient.post('/auth/verify', {
            message,
            signature,
            provider,
        });
        return data;
    },

    logout: async (refreshToken: string): Promise<void> => {
        await apiClient.post('/auth/logout', { refreshToken });
    },
};

export default apiClient;
