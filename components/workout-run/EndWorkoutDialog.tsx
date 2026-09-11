'use client';

import { Button } from '@/components/ui/Button';

export function EndWorkoutDialog({
  open,
  onSavePartial,
  onDiscard,
  onContinue,
}: {
  open: boolean;
  onSavePartial: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}) {
  if (!open) return null;
  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">End this workout?</h2>
        <p className="mt-2 text-sm text-text-muted">Your progress so far can be saved as a partial workout.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={onSavePartial}>Save Partial Workout</Button>
          <Button variant="danger" onClick={onDiscard}>
            End Without Saving
          </Button>
          <Button variant="ghost" onClick={onContinue}>
            Continue Workout
          </Button>
        </div>
      </div>
    </div>
  );
}
