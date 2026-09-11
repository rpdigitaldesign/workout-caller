'use client';

import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ActiveWorkoutRecovery } from '@/lib/offline/localStore';

export function RecoveryPrompt({
  recovery,
  onDiscard,
}: {
  recovery: ActiveWorkoutRecovery;
  onDiscard: () => void;
}) {
  const router = useRouter();

  const handleResume = () => {
    // The run page reads the full recovery record (including saved timer
    // position) directly from IndexedDB when `recover=1` is present — the
    // runId here is just a fresh URL slot, not a draft handoff.
    router.push(`/workout/${uuid()}/run?recover=1`);
  };

  return (
    <Card className="border-warn">
      <h2 className="mb-1 text-lg font-semibold">Unfinished workout</h2>
      <p className="mb-3 text-sm text-text-muted">
        &quot;{recovery.workout.title}&quot; didn&apos;t finish last time. Resume where you left off, or discard it.
      </p>
      <div className="flex gap-3">
        <Button onClick={handleResume}>Resume Workout</Button>
        <Button variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </Card>
  );
}
