'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional third action rendered between Cancel and Confirm (e.g. "Save draft" on an unsaved-changes prompt). Additive — omitting it renders exactly as before. */
  extraAction?: { label: string; onClick: () => void };
  /** Which button receives focus when the dialog opens. Defaults to 'confirm' (the
   * existing behavior for e.g. "Delete this template?", where the user already
   * expressed intent by clicking the triggering action). Pass 'cancel' for dialogs
   * where opening the dialog itself doesn't imply the user wants the destructive
   * option — e.g. an unsaved-changes prompt triggered by a neutral "Back" tap —
   * so a reflexive Enter/Space doesn't discard something the user didn't ask to discard. */
  initialFocus?: 'confirm' | 'cancel';
}

/**
 * Used for every destructive/hard-to-undo action per spec section 64
 * (End Workout, Delete Template, Delete Scheduled Workout, destructive
 * batch actions) — deliberately NOT used for Pause/Resume/Skip.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  extraAction,
  initialFocus = 'confirm',
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    (initialFocus === 'cancel' ? cancelRef : confirmRef).current?.focus();
  }, [open, initialFocus]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-text">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-text-muted">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {extraAction && (
            <Button variant="secondary" onClick={extraAction.onClick}>
              {extraAction.label}
            </Button>
          )}
          <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
