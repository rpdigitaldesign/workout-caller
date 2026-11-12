'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * While `active`, an accidental way out of the page (the browser/Android back
 * gesture, a reload, closing the tab) asks first instead of just leaving.
 *
 * - Back gesture: a spare history entry sits on top of the page. Going back lands
 *   on the page itself, we put the spare entry back and call `onAttemptLeave` so
 *   the screen can ask "Leave this workout?".
 * - Reload / close: the browser's own "leave site?" prompt (not every browser,
 *   notably iOS home-screen apps, shows it).
 *
 * `leave()` removes the guard and goes back past both entries.
 */
export function useLeaveGuard(active: boolean, onAttemptLeave: () => void): { leave: () => void } {
  const attemptRef = useRef(onAttemptLeave);
  useEffect(() => {
    attemptRef.current = onAttemptLeave;
  }, [onAttemptLeave]);
  const guardOffRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    guardOffRef.current = false;
    window.history.pushState({ workoutLeaveGuard: true }, '');

    const onPopState = () => {
      if (guardOffRef.current) return;
      window.history.pushState({ workoutLeaveGuard: true }, '');
      attemptRef.current();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (guardOffRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [active]);

  const leave = useCallback(() => {
    guardOffRef.current = true;
    window.history.go(-2);
  }, []);

  return { leave };
}
