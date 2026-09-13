import type { TimerSnapshot } from '@/lib/workout/engine';
import { formatDuration } from '@/lib/workout/duration';
import { ProgressBar } from './ProgressBar';
import { Button } from '@/components/ui/Button';

/**
 * Deliberately distinct from ExerciseScreen beyond just color: a
 * different background shade AND a large "REST" headline (rather than an
 * exercise name) AND a differently-labeled "NEXT" block, so rest is
 * unmistakable even without relying on color perception.
 *
 * Height-budget contract: this root is `h-dvh overflow-hidden`, never
 * scrollable. Header and footer are `shrink-0` — they must always fit —
 * and only the middle (purely decorative) region is allowed to be
 * squeezed via `overflow-hidden` + `line-clamp`.
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
    <div className="flex h-dvh flex-col items-center overflow-hidden bg-[#071a26] px-6 py-8 short:py-3 text-center">
      <p className="mt-2 shrink-0 text-4xl font-extrabold uppercase tracking-widest text-rest sm:text-5xl short:text-2xl">
        Rest
      </p>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden short:gap-2">
        <p aria-live="off" className="text-[min(28vw,22dvh,200px)] font-black leading-none tabular-nums">
          {seconds !== null ? formatDuration(seconds) : '∞'}
        </p>
        {snapshot.nextSegment && (
          <div className="min-h-0">
            <p className="text-sm font-semibold uppercase tracking-widest text-text-muted short:text-xs">Next</p>
            <p className="line-clamp-1 text-3xl font-bold short:text-xl">{snapshot.nextSegment.name}</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-md shrink-0">
        <ProgressBar fraction={fraction} />
        <div className="mt-6 flex justify-center gap-4 short:mt-2 short:gap-2">
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
          <Button size="lg" variant="secondary" onClick={onPause} className="flex-1 short:min-h-10 short:py-2 short:text-sm">
            Pause
          </Button>
          <Button size="lg" variant="secondary" onClick={onSkip} className="flex-1 short:min-h-10 short:py-2 short:text-sm">
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
