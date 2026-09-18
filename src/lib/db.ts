// ============================================================================
// Supabase / Postgres client
//
// Two clients are exported:
//   - supabaseServer(): full access, service-role key. SERVER-SIDE ONLY.
//     Used inside API routes / Server Actions where we've already checked
//     the user's session and RBAC permissions ourselves.
//   - supabaseBrowser(): anon key, safe for client components. Relies on
//     Postgres Row Level Security (RLS) policies for authorization.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serverClient: SupabaseClient | null = null;
let browserClient: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseServer() must only be called on the server.');
  }

  if (!serverClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
      );
    }

    serverClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return serverClient;
}

export function supabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.'
      );
    }

    browserClient = createClient(url, anonKey);
  }

  return browserClient;
}
