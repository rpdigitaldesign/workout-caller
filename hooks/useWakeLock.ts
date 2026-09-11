'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Requests a screen wake lock while `active` is true, feature-detecting
 * gracefully where unsupported, and reacquiring it when the tab returns
 * to the foreground (a wake lock is automatically released by the
 * browser when a page is hidden).
 */
export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Denied or unsupported in this context — fail silently, the workout still runs.
    }
  }, []);

  const releaseLock = useCallback(() => {
    void wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) {
      releaseLock();
      return;
    }
    void requestLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        void requestLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseLock();
    };
  }, [active, requestLock, releaseLock]);
}
