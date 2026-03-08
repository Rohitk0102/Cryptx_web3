import { useAuth, useUser } from '@clerk/nextjs';
import axios, { type AxiosRequestConfig, type Method } from 'axios';
import { API_BASE_URL } from '@/lib/apiConfig';

type ApiRequestConfig = Omit<AxiosRequestConfig, 'data' | 'headers' | 'method' | 'url'> & {
    headers?: Record<string, string>;
};

/**
 * Hook that provides an authenticated API client using Clerk tokens
 */
export function useApiClient() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const clerkUserId = user?.id;

    const apiRequest = async <T = unknown>(
        method: Method,
        url: string,
        data?: unknown,
        config: ApiRequestConfig = {}
    ): Promise<T> => {
        const token = await getToken();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(config?.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (clerkUserId) {
            headers['X-Clerk-User-Id'] = clerkUserId;
        }

        const response = await axios<T>({
            method,
            url: `${API_BASE_URL}${url}`,
            data,
            ...config,
            headers,
        });

        return response.data;
    };

    const get = <T = unknown>(url: string, config?: ApiRequestConfig) =>
        apiRequest<T>('get', url, undefined, config);

    const post = <T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig) =>
        apiRequest<T>('post', url, data, config);

    const put = <T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig) =>
        apiRequest<T>('put', url, data, config);

    const patch = <T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig) =>
        apiRequest<T>('patch', url, data, config);

    const del = <T = unknown>(url: string, config?: ApiRequestConfig) =>
        apiRequest<T>('delete', url, undefined, config);

    return {
        get,
        post,
        put,
        patch,
        delete: del,
    };
}
