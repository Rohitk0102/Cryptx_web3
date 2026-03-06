'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { setClerkAuth, setClerkTokenGetter, clearClerkAuth } from '@/lib/api';

interface ClerkAuthSyncProps {
    onAuthSynced?: () => void;
}

/**
 * Component that syncs Clerk authentication with the API client
 * Must be rendered inside ClerkProvider and inside pages that need API access
 */
export default function ClerkAuthSync({ onAuthSynced }: ClerkAuthSyncProps = {}) {
    const { getToken, isSignedIn } = useAuth();
    const { user } = useUser();
    const [hasSynced, setHasSynced] = useState(false);
    
    // Use ref to avoid dependency issues with callback
    const onAuthSyncedRef = useRef(onAuthSynced);
    onAuthSyncedRef.current = onAuthSynced;

    // Create a stable token getter function
    const tokenGetter = useCallback(async () => {
        return await getToken();
    }, [getToken]);

    useEffect(() => {
        if (isSignedIn && user) {
            // Set up the token getter for dynamic token refresh
            setClerkTokenGetter(tokenGetter, user.id);
            
            // Also do an initial sync
            tokenGetter().then(token => {
                if (token) {
                    setClerkAuth(token, user.id);
                    console.log('✅ Clerk auth synced to API client');
                    if (!hasSynced) {
                        setHasSynced(true);
                        // Dispatch auth-synced event
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('auth-synced'));
                        }
                        // Use ref to call callback without adding to dependencies
                        if (onAuthSyncedRef.current) {
                            onAuthSyncedRef.current();
                        }
                    }
                }
            });
        } else {
            // User signed out - clear auth and cache
            console.log('🔓 User signed out, clearing auth');
            clearClerkAuth();
            setHasSynced(false);
        }

        return () => {
            // Don't clear auth on unmount as other components may still need it
        };
    }, [isSignedIn, user, tokenGetter, hasSynced]);

    // This component doesn't render anything
    return null;
}
