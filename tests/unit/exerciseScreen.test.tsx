import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExerciseScreen } from '@/components/workout-run/ExerciseScreen';
import type { Segment, TimerSnapshot } from '@/lib/workout/engine';

const segment = (over: Partial<Segment> = {}): Segment => ({
  key: 'k', origin: 'main', kind: 'exercise', name: 'Push-ups', durationSeconds: null, reps: 12, announce: null,
  stepId: 's', roundNumber: 1, ...over,
});
const snapshot = (over: Partial<TimerSnapshot> = {}): TimerSnapshot => ({
  state: 'exercise', segmentIndex: 0, totalSegments: 3, roundNumber: 1, totalRounds: 1, remainingMs: null, targetEndTimestamp: null,
  elapsedTotalMs: 0, isManualAdvance: true, currentSegment: segment(), nextSegment: null, nextExercise: null, previousSegment: null,
  prevAvailable: false, completionReason: null, ...over,
});

const noop = () => {};

describe('ExerciseScreen Next button (rep-based exercises)', () => {
  it('shows one large Next button that advances the workout', () => {
    const onAdvance = vi.fn();
    render(<ExerciseScreen snapshot={snapshot()} onPause={noop} onSkip={noop} onPrevious={noop} onAdvanceManual={onAdvance} />);
    const next = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(next);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(next.className).toContain('min-h-24'); // 96px tall, well above the 44px minimum
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('timed exercises keep Previous, Pause and Skip instead', () => {
    render(
      <ExerciseScreen
        snapshot={snapshot({ isManualAdvance: false, remainingMs: 20000, currentSegment: segment({ reps: null, durationSeconds: 30 }) })}
        onPause={noop} onSkip={noop} onPrevious={noop} onAdvanceManual={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });
});
