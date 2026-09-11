'use client';

import { useEffect } from 'react';

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** A simple modal panel — bottom sheet on narrow screens, centered dialog on wide ones. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="sheet-title" className="text-lg font-semibold text-text">
            {title}
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="focus-ring rounded-lg px-3 py-2 text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
