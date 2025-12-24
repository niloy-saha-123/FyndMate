/**
 * @file src/lib/supabase.ts
 * @description Supabase admin client for server-side operations. Uses the
 *              SERVICE_ROLE_KEY which bypasses Row Level Security (RLS).
 *              Use for: token verification, storage uploads, and admin operations.
 *              NEVER expose the service role key to the client.
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

// Admin client with service role key (bypasses RLS)
// Use this for:
// - Verifying user tokens
// - Uploading files to storage
// - Admin operations that need to bypass row-level security
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Export the URL for use in other places
export { supabaseUrl };

