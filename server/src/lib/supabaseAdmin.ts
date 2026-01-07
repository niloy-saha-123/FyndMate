/**
 * @file src/lib/supabaseAdmin.ts
 * @description Supabase Admin Client (Server-Side Only)
 * 
 * PURPOSE:
 * This file creates a Supabase client with ADMIN privileges using the SERVICE_ROLE_KEY.
 * This key bypasses Row Level Security (RLS) and should NEVER be exposed to clients.
 * 
 * USE CASES:
 * ✅ Verifying user JWT tokens in auth middleware
 * ✅ Creating user accounts in signup flow
 * ✅ Uploading files to Supabase Storage (bypasses RLS)
 * ✅ Admin operations that need full database access
 * 
 * SECURITY:
 * ❌ NEVER import this in client code
 * ❌ NEVER expose SERVICE_ROLE_KEY in frontend
 * ✅ ONLY use in server-side code (routes, services, middleware)
 * 
 * WHY TWO SUPABASE CLIENTS?
 * - Client uses ANON_KEY → Limited by Row Level Security policies
 * - Server uses SERVICE_ROLE_KEY → Full admin access, bypasses RLS
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
}

if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
}

/**
 * Supabase Admin Client
 * Uses SERVICE_ROLE_KEY for full admin access
 * Bypasses Row Level Security (RLS)
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// Export URL for convenience
export { supabaseUrl };
