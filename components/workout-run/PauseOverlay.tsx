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
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-black/90 px-6 text-center">
      <p className="text-3xl font-extrabold uppercase tracking-widest text-warn">Paused</p>
      {snapshot.currentSegment && (
        <div>
          <p className="text-xl text-text-muted">{snapshot.currentSegment.name}</p>
          {seconds !== null && <p className="text-5xl font-bold tabular-nums">{formatDuration(seconds)}</p>}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onResume}>
          Resume
        </Button>
        <Button size="lg" variant="danger" onClick={onEndEarly}>
          End Workout
        </Button>
      </div>
    </div>
  );
}
