'use client';

/**
 * The one "Back" control used at the top of every sub-page.
 * At least 44x44px to tap (iOS guideline) while looking like a quiet text link.
 * The negative left margin keeps the visible text aligned with the page content
 * while the tap area extends past it. Pass `label` to say where it goes for
 * screen readers (e.g. "Back to Calendar"); the visible text stays "Back".
 */
export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring -ml-3 inline-flex min-h-11 min-w-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-text-muted hover:text-text"
    >
      <span aria-hidden="true">‹</span> Back
    </button>
  );
}
