'use client';

import { useEffect, useRef, useState } from 'react';

export interface MoreMenuItem {
  label: string;
  onSelect: () => void;
  /** Rendered in the danger colour and separated from the other items. */
  danger?: boolean;
}

/**
 * A "⋯" button that opens a small menu of secondary actions, so a card can keep
 * one clear primary action plus one or two quiet buttons. At least 44x44px to tap.
 * Closes on selection, Escape, or a tap outside; Escape returns focus to the button.
 */
export function MoreMenu({ items, label = 'More actions' }: { items: MoreMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-raised text-text transition-colors hover:bg-border"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-surface-raised p-1 shadow-lg"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`focus-ring flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-border ${
                item.danger ? 'mt-1 border-t border-border text-danger' : 'text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
