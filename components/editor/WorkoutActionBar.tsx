'use client';

import { Button } from '@/components/ui/Button';

export interface WorkoutActionBarProps {
  canStart: boolean;
  onStart: () => void;
  onSaveAsTemplate?: () => void;
  onSchedule?: () => void;
  saving?: boolean;
}

/**
 * One row: Start Workout is the main action (it takes the spare width); Save
 * (as a template) and Schedule are quiet secondary buttons. Sits above the
 * bottom navigation on phones.
 */
export function WorkoutActionBar({ canStart, onStart, onSaveAsTemplate, onSchedule, saving }: WorkoutActionBarProps) {
  return (
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-4 flex items-center gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:bottom-0 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
      <Button size="md" disabled={!canStart || saving} onClick={onStart} className="flex-1 sm:flex-none sm:px-6">
        Start Workout
      </Button>
      {onSaveAsTemplate && (
        <Button
          variant="secondary"
          disabled={!canStart || saving}
          onClick={onSaveAsTemplate}
          aria-label="Save as template"
        >
          Save
        </Button>
      )}
      {onSchedule && (
        <Button variant="secondary" disabled={!canStart || saving} onClick={onSchedule}>
          Schedule
        </Button>
      )}
    </div>
  );
}
