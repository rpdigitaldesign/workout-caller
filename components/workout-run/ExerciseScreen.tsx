import type { TimerSnapshot } from '@/lib/workout/engine';
import { formatDuration } from '@/lib/workout/duration';
import { ProgressBar } from './ProgressBar';
import { Button } from '@/components/ui/Button';

/**
 * Height-budget contract: this root is `h-dvh overflow-hidden`, never
 * scrollable. Header and footer are `shrink-0` — they must always fit —
 * and only the middle (purely decorative) region is allowed to be
 * squeezed via `overflow-hidden` + `line-clamp`. If you add content here,
 * keep it inside that budget rather than letting the page grow.
 */
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
    <div className="flex h-dvh flex-col items-center overflow-hidden bg-bg px-6 py-8 short:py-3 text-center">
      <div className="shrink-0">
        {snapshot.roundNumber !== null && (
          <p className="text-lg font-semibold uppercase tracking-widest text-text-muted short:text-sm">
            Round {snapshot.roundNumber} of {snapshot.totalRounds}
          </p>
        )}
        <h1 className="mt-2 line-clamp-2 text-4xl font-extrabold uppercase tracking-tight sm:text-5xl short:text-2xl">
          {segment.name}
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden short:gap-2">
        {segment.reps !== null ? (
          <p aria-live="off" className="flex items-baseline gap-2 leading-none">
            <span className="text-[min(28vw,22dvh,200px)] font-black tabular-nums">{segment.reps}</span>
            <span className="text-2xl font-bold uppercase tracking-wide text-text-muted short:text-lg">reps</span>
          </p>
        ) : (
          <p aria-live="off" className="text-[min(28vw,22dvh,200px)] font-black leading-none tabular-nums">
            {seconds !== null ? formatDuration(seconds) : '∞'}
          </p>
        )}
        {snapshot.nextSegment && (
          <p className="line-clamp-1 text-xl text-text-muted short:text-base">
            Next: <span className="font-semibold text-text">{snapshot.nextSegment.name}</span>
          </p>
        )}
      </div>

      <div className="w-full max-w-md shrink-0 self-center">
        <ProgressBar fraction={fraction} />
        <div className="mt-6 flex justify-center gap-4 short:mt-2 short:gap-2">
          {snapshot.isManualAdvance ? (
            <Button size="lg" onClick={onAdvanceManual} className="flex-1 short:min-h-10 short:py-2 short:text-sm">
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
                className="short:min-h-10 short:py-2 short:text-sm"
              >
                ↺ Prev
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={onPause}
                className="flex-1 short:min-h-10 short:py-2 short:text-sm"
              >
                Pause
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={onSkip}
                className="flex-1 short:min-h-10 short:py-2 short:text-sm"
              >
                Skip
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
