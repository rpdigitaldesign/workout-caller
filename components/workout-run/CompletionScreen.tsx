import type { TimerSnapshot } from '@/lib/workout/engine';
import { formatDuration } from '@/lib/workout/duration';
import { Button } from '@/components/ui/Button';

export function CompletionScreen({
  snapshot,
  synced,
  onDone,
  onRepeat,
}: {
  snapshot: TimerSnapshot;
  synced: boolean | null; // null while saving, true if synced immediately, false if queued for later sync
  onDone: () => void;
  onRepeat: () => void;
}) {
  const isPartial = snapshot.completionReason === 'early';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <p className="text-3xl font-extrabold uppercase tracking-widest text-accent">
        {isPartial ? 'Workout Ended' : 'Workout Complete'}
      </p>
      <p className="text-6xl font-black tabular-nums">{formatDuration(Math.round(snapshot.elapsedTotalMs / 1000))}</p>
      <p className="text-lg text-text-muted">
        {snapshot.segmentIndex + 1} of {snapshot.totalSegments} intervals {isPartial ? 'completed' : 'done'}
      </p>
      {synced === false && (
        <p className="text-sm text-warn">Saved on this device — will sync once you&apos;re back online.</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onDone}>
          Done
        </Button>
        <Button size="lg" variant="secondary" onClick={onRepeat}>
          Repeat Workout
        </Button>
      </div>
    </div>
  );
}
