import type { TimerSnapshot } from '@/lib/workout/engine';
import { formatDuration } from '@/lib/workout/duration';
import { ProgressBar } from './ProgressBar';
import { Button } from '@/components/ui/Button';

/**
 * Deliberately distinct from ExerciseScreen beyond just color: a
 * different background shade AND a large "REST" headline (rather than an
 * exercise name) AND a differently-labeled "NEXT" block, so rest is
 * unmistakable even without relying on color perception.
 */
export function RestScreen({
  snapshot,
  onPause,
  onSkip,
  onPrevious,
}: {
  snapshot: TimerSnapshot;
  onPause: () => void;
  onSkip: () => void;
  onPrevious: () => void;
}) {
  const segment = snapshot.currentSegment!;
  const seconds = snapshot.remainingMs !== null ? Math.ceil(snapshot.remainingMs / 1000) : null;
  const fraction =
    segment.durationSeconds && snapshot.remainingMs !== null ? 1 - snapshot.remainingMs / (segment.durationSeconds * 1000) : 0;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-[#071a26] px-6 py-8 text-center">
      <p className="mt-2 text-4xl font-extrabold uppercase tracking-widest text-rest sm:text-5xl">Rest</p>

      <div className="flex flex-col items-center gap-4">
        <p aria-live="off" className="text-[min(28vw,200px)] font-black leading-none tabular-nums">
          {seconds !== null ? formatDuration(seconds) : '∞'}
        </p>
        {snapshot.nextSegment && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-text-muted">Next</p>
            <p className="text-3xl font-bold">{snapshot.nextSegment.name}</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-md">
        <ProgressBar fraction={fraction} />
        <div className="mt-6 flex justify-center gap-4">
          <Button size="lg" variant="ghost" onClick={onPrevious} disabled={!snapshot.prevAvailable} aria-label="Previous interval">
            ↺ Prev
          </Button>
          <Button size="lg" variant="secondary" onClick={onPause} className="flex-1">
            Pause
          </Button>
          <Button size="lg" variant="secondary" onClick={onSkip} className="flex-1">
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
