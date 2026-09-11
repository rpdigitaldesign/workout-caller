import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for use in Server Components, Route
 * Handlers, and Server Actions. Reads/writes the auth session via
 * cookies. Uses the public anon key (not the service role key) — RLS
 * still applies, scoped to the signed-in user's auth.uid().
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component with no response to attach cookies to —
            // safe to ignore as long as middleware.ts also refreshes the session.
          }
        },
      },
    },
  );
}
