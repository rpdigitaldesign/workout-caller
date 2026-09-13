import type { TimerSnapshot } from '@/lib/workout/engine';
import { formatDuration } from '@/lib/workout/duration';
import { Button } from '@/components/ui/Button';

/**
 * Height-budget contract: this root is `h-dvh overflow-hidden`, never
 * scrollable. Header and footer (the Done/Repeat controls) are
 * `shrink-0` — they must always fit — and only the middle (elapsed-time
 * display) region is allowed to be squeezed.
 */
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
    <div className="flex h-dvh flex-col items-center overflow-hidden bg-bg px-6 py-8 text-center short:py-3">
      <p className="shrink-0 text-3xl font-extrabold uppercase tracking-widest text-accent short:text-xl">
        {isPartial ? 'Workout Ended' : 'Workout Complete'}
      </p>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden short:gap-1.5">
        <p className="text-[min(15vw,10dvh,80px)] font-black tabular-nums">
          {formatDuration(Math.round(snapshot.elapsedTotalMs / 1000))}
        </p>
        <p className="text-lg text-text-muted short:text-sm">
          {snapshot.segmentIndex + 1} of {snapshot.totalSegments} intervals {isPartial ? 'completed' : 'done'}
        </p>
        {synced === false && (
          <p className="line-clamp-2 text-sm text-warn short:text-xs">
            Saved on this device — will sync once you&apos;re back online.
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 short:flex-row short:gap-2 sm:flex-row">
        <Button size="lg" onClick={onDone} className="short:min-h-10 short:py-2 short:text-sm">
          Done
        </Button>
        <Button size="lg" variant="secondary" onClick={onRepeat} className="short:min-h-10 short:py-2 short:text-sm">
          Repeat Workout
        </Button>
      </div>
    </div>
  );
}
