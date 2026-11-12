import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signOutThisDevice, unsyncedWorkoutsWarning } from '@/lib/auth/signOut';

function fakeClient(result: unknown) {
  const signOut = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { auth: { signOut } } as unknown as SupabaseClient, signOut };
}

describe('signOutThisDevice', () => {
  it('signs out with local scope only, never the default global scope', async () => {
    const { client, signOut } = fakeClient({ error: null });
    await signOutThisDevice(client);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('returns null on success', async () => {
    const { client } = fakeClient({ error: null });
    expect(await signOutThisDevice(client)).toBeNull();
  });

  it('returns the error message when Supabase reports an error', async () => {
    const { client } = fakeClient({ error: { message: 'boom' } });
    expect(await signOutThisDevice(client)).toBe('boom');
  });

  it('returns a message instead of throwing when the call rejects', async () => {
    const { client } = fakeClient(new Error('network down'));
    expect(await signOutThisDevice(client)).toBe('network down');
  });
});

describe('unsyncedWorkoutsWarning', () => {
  it('uses singular wording for one workout', () => {
    const text = unsyncedWorkoutsWarning(1);
    expect(text).toContain('1 finished workout has');
    expect(text).toContain('it stays');
  });

  it('uses plural wording for several workouts', () => {
    const text = unsyncedWorkoutsWarning(3);
    expect(text).toContain('3 finished workouts have');
    expect(text).toContain('they stay');
  });
});
