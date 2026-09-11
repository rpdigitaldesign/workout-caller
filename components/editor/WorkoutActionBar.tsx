'use client';

import { Button } from '@/components/ui/Button';

export interface WorkoutActionBarProps {
  canStart: boolean;
  onStart: () => void;
  onSaveAsTemplate?: () => void;
  onSchedule?: () => void;
  onBack?: () => void;
  saving?: boolean;
}

export function WorkoutActionBar({ canStart, onStart, onSaveAsTemplate, onSchedule, onBack, saving }: WorkoutActionBarProps) {
  return (
    <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
      <Button size="lg" disabled={!canStart || saving} onClick={onStart} className="flex-1 sm:flex-none">
        Start Workout
      </Button>
      {onSaveAsTemplate && (
        <Button variant="secondary" disabled={!canStart || saving} onClick={onSaveAsTemplate}>
          Save as Template
        </Button>
      )}
      {onSchedule && (
        <Button variant="secondary" disabled={!canStart || saving} onClick={onSchedule}>
          Schedule
        </Button>
      )}
      {onBack && (
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          Back
        </Button>
      )}
    </div>
  );
}
