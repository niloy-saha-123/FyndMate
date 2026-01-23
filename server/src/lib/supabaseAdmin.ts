/**
 * @file src/lib/supabaseAdmin.ts
 * @description Supabase Admin Client (Server-Side Only)
 *              Initialize Supabase client with SERVICE_ROLE_KEY to bypass RLS.
 *              WARNING: This key has full admin access and must never be exposed to clients.
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

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export { supabaseUrl };
