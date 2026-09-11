import type { TimerSnapshot } from '@/lib/workout/engine';
import { formatDuration } from '@/lib/workout/duration';
import { ProgressBar } from './ProgressBar';
import { Button } from '@/components/ui/Button';

export function ExerciseScreen({
  snapshot,
  onPause,
  onSkip,
  onPrevious,
  onAdvanceManual,
}: {
  snapshot: TimerSnapshot;
  onPause: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onAdvanceManual: () => void;
}) {
  const segment = snapshot.currentSegment!;
  const seconds = snapshot.remainingMs !== null ? Math.ceil(snapshot.remainingMs / 1000) : null;
  const fraction =
    segment.durationSeconds && snapshot.remainingMs !== null ? 1 - snapshot.remainingMs / (segment.durationSeconds * 1000) : 0;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-bg px-6 py-8 text-center">
      <div>
        {snapshot.roundNumber !== null && (
          <p className="text-lg font-semibold uppercase tracking-widest text-text-muted">
            Round {snapshot.roundNumber} of {snapshot.totalRounds}
          </p>
        )}
        <h1 className="mt-2 text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">{segment.name}</h1>
      </div>

      <div className="flex flex-col items-center gap-4">
        <p aria-live="off" className="text-[min(28vw,200px)] font-black leading-none tabular-nums">
          {seconds !== null ? formatDuration(seconds) : '∞'}
        </p>
        {snapshot.nextSegment && (
          <p className="text-xl text-text-muted">
            Next: <span className="font-semibold text-text">{snapshot.nextSegment.name}</span>
          </p>
        )}
      </div>

      <div className="w-full max-w-md">
        <ProgressBar fraction={fraction} />
        <div className="mt-6 flex justify-center gap-4">
          {snapshot.isManualAdvance ? (
            <Button size="lg" onClick={onAdvanceManual} className="flex-1">
              Next
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="ghost"
                onClick={onPrevious}
                disabled={!snapshot.prevAvailable}
                aria-label="Previous interval"
              >
                ↺ Prev
              </Button>
              <Button size="lg" variant="secondary" onClick={onPause} className="flex-1">
                Pause
              </Button>
              <Button size="lg" variant="secondary" onClick={onSkip} className="flex-1">
                Skip
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
