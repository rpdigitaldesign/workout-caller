import type { TimerSnapshot } from '@/lib/workout/engine';

export function GetReadyScreen({ snapshot }: { snapshot: TimerSnapshot }) {
  const seconds = snapshot.remainingMs !== null ? Math.ceil(snapshot.remainingMs / 1000) : 0;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <p className="text-2xl font-semibold uppercase tracking-widest text-text-muted">Get Ready</p>
      <p aria-live="assertive" className="text-[min(35vw,220px)] font-black leading-none tabular-nums">
        {seconds > 0 ? seconds : ''}
      </p>
      {snapshot.nextSegment && <p className="text-xl text-text-muted">First: {snapshot.nextSegment.name}</p>}
    </div>
  );
}
