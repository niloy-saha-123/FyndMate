/**
 * @file client/src/components/ApiClientInitializer.tsx
 * @description Initializes the apiClient with auth token getter and 401 handler.
 * Must be rendered inside AuthProvider to access auth context.
 */

import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { initApiClient } from '../lib/apiClient';
import { supabase } from '../auth/supabaseClient';

export function ApiClientInitializer({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();

  useEffect(() => {
    // Initialize API client with token getter and 401 handler
    initApiClient(
      // Token getter - returns current access token from auth context
      () => accessToken,
      // 401 handler - clears session and redirects to login
      async () => {
        console.warn('🔐 Session expired or invalid. Signing out...');
        await supabase.auth.signOut();
        router.replace('/login');
      }
    );
  }, [accessToken]);

  return <>{children}</>;
}
