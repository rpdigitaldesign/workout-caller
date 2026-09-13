import type { TimerSnapshot } from '@/lib/workout/engine';

export function GetReadyScreen({ snapshot }: { snapshot: TimerSnapshot }) {
  const seconds = snapshot.remainingMs !== null ? Math.ceil(snapshot.remainingMs / 1000) : 0;
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-bg px-6 text-center short:gap-2">
      <p className="text-2xl font-semibold uppercase tracking-widest text-text-muted short:text-lg">Get Ready</p>
      <p aria-live="assertive" className="text-[min(35vw,30dvh,220px)] font-black leading-none tabular-nums">
        {seconds > 0 ? seconds : ''}
      </p>
      {snapshot.nextSegment && (
        <p className="line-clamp-1 text-xl text-text-muted short:text-base">First: {snapshot.nextSegment.name}</p>
      )}
    </div>
  );
}
