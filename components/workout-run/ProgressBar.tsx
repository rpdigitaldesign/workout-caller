export function ProgressBar({ fraction }: { fraction: number }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-3 w-full overflow-hidden rounded-full bg-surface-raised short:h-2"
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}
