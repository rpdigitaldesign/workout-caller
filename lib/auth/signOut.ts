import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Signs out of THIS device only.
 *
 * Supabase's default `signOut()` is global: it revokes every session the account
 * has, which would also sign the owner out of their other devices. `scope: 'local'`
 * ends only the current browser's session, which is what "Sign out" on a settings
 * screen means to the person pressing it.
 *
 * Returns the error message on failure (null on success). Note that local sign-out
 * clears the browser's stored session even if the network call to Supabase fails.
 */
export async function signOutThisDevice(client: SupabaseClient): Promise<string | null> {
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Sign-out failed.';
  }
}

/** Plain-language warning shown before signing out while finished workouts are not yet synced. */
export function unsyncedWorkoutsWarning(count: number): string {
  const noun = count === 1 ? 'finished workout has' : 'finished workouts have';
  return `${count} ${noun} not synced to your account yet. If you sign out now, ${
    count === 1 ? 'it stays' : 'they stay'
  } on this device and will sync after you sign back in. Syncing first needs an internet connection.`;
}
