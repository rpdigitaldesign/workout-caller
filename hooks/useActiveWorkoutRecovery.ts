'use client';

import { useEffect, useState } from 'react';
import { clearActiveWorkout, loadActiveWorkout, type ActiveWorkoutRecovery } from '@/lib/offline/localStore';

export function useActiveWorkoutRecovery() {
  const [recovery, setRecovery] = useState<ActiveWorkoutRecovery | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadActiveWorkout().then((state) => {
      if (!cancelled) setRecovery(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const discard = async () => {
    await clearActiveWorkout();
    setRecovery(null);
  };

  return { recovery, discard };
}
