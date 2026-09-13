import type { TimerSnapshot } from '@/lib/workout/engine';
import { formatDuration } from '@/lib/workout/duration';
import { Button } from '@/components/ui/Button';

export function PauseOverlay({
  snapshot,
  onResume,
  onEndEarly,
}: {
  snapshot: TimerSnapshot;
  onResume: () => void;
  onEndEarly: () => void;
}) {
  const seconds = snapshot.remainingMs !== null ? Math.ceil(snapshot.remainingMs / 1000) : null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 overflow-hidden bg-black/90 px-6 text-center short:gap-3">
      <p className="text-3xl font-extrabold uppercase tracking-widest text-warn short:text-xl">Paused</p>
      {snapshot.currentSegment && (
        <div className="min-h-0">
          <p className="line-clamp-2 text-xl text-text-muted short:text-base">{snapshot.currentSegment.name}</p>
          {seconds !== null && (
            <p className="text-5xl font-bold tabular-nums short:text-3xl">{formatDuration(seconds)}</p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 short:flex-row short:gap-2 sm:flex-row">
        <Button size="lg" onClick={onResume} className="short:min-h-10 short:py-2 short:text-sm">
          Resume
        </Button>
        <Button size="lg" variant="danger" onClick={onEndEarly} className="short:min-h-10 short:py-2 short:text-sm">
          End Workout
        </Button>
      </div>
    </div>
  );
}
