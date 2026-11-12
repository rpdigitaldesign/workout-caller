'use client';

import { useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { flushPendingSessions, listPendingSessions } from '@/lib/offline/syncQueue';
import { useAuthUser } from './useAuthUser';

/**
 * Uploads finished workouts that were saved on this device while offline: when the
 * app opens, when the connection comes back, and when the app returns to the
 * foreground. Does nothing when signed out or when nothing is waiting. Failures
 * are silent; the workout stays queued and the next trigger tries again.
 */
export function useAutoSyncSessions(): void {
  const user = useAuthUser();
  const signedIn = Boolean(user);

  useEffect(() => {
    if (!signedIn) return;
    const sync = () => {
      void listPendingSessions().then((pending) => {
        if (pending.length === 0) return;
        return flushPendingSessions(createSupabaseBrowserClient());
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    sync();
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn]);
}
