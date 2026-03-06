import { useAuth, useUser } from '@clerk/nextjs';
import { useCallback, useMemo } from 'react';
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

/**
 * Hook that provides an authenticated API client using Clerk tokens
 */
export function useApiClient() {
    const { getToken } = useAuth();
    const { user } = useUser();

    const apiRequest = useCallback(async <T = any>(
        method: 'get' | 'post' | 'put' | 'patch' | 'delete',
        url: string,
        data?: any,
        config?: any
    ): Promise<T> => {
        const token = await getToken();
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(config?.headers || {}),
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (user?.id) {
            headers['X-Clerk-User-Id'] = user.id;
        }

        const response = await axios({
            method,
            url: `${API_BASE_URL}${url}`,
            data,
            headers,
            ...config,
        });

        return response.data;
    }, [getToken, user?.id]);

    const get = useCallback(<T = any>(url: string, config?: any) => 
        apiRequest<T>('get', url, undefined, config), [apiRequest]);

    const post = useCallback(<T = any>(url: string, data?: any, config?: any) => 
        apiRequest<T>('post', url, data, config), [apiRequest]);

    const put = useCallback(<T = any>(url: string, data?: any, config?: any) => 
        apiRequest<T>('put', url, data, config), [apiRequest]);

    const patch = useCallback(<T = any>(url: string, data?: any, config?: any) => 
        apiRequest<T>('patch', url, data, config), [apiRequest]);

    const del = useCallback(<T = any>(url: string, config?: any) => 
        apiRequest<T>('delete', url, undefined, config), [apiRequest]);

    return {
        get,
        post,
        put,
        patch,
        delete: del,
    };
}
