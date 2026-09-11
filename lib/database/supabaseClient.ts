import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client. Uses the public anon key — safe to expose
 * to client code because every table is protected by Row Level Security
 * scoped to auth.uid() (see supabase/migrations/0002_rls.sql).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
