'use client';

import { useEffect, useRef } from 'react';
import type { TimerSnapshot } from '@/lib/workout/engine';
import { speechController, buildSegmentAnnouncement, countdownThresholdSeconds, type SpeechSettings } from '@/lib/speech/speech';
import { toneController } from '@/lib/audio/tones';

interface PrevState {
  segmentIndex: number;
  state: TimerSnapshot['state'];
  roundNumber: number | null;
}

/**
 * The single place that drives speech + tone side effects for an active
 * run, by diffing consecutive timer snapshots. Deliberately NOT inside
 * WorkoutEngine itself (keeps the engine pure/testable with zero I/O).
 * At most one speechController.speak() call happens per effect run — if
 * multiple things would announce at once (e.g. "Workout starting" and the
 * first get-ready number), they're combined into a single utterance
 * rather than issued as separate speak() calls that would cancel each
 * other mid-sentence.
 */
export function useIntervalAnnouncements(snapshot: TimerSnapshot, settings: SpeechSettings, tonesEnabled: boolean) {
  const prevRef = useRef<PrevState | null>(null);
  const lastCountdownSecondRef = useRef<number | null>(null);
  const announcedStartRef = useRef(false);

  useEffect(() => {
    toneController.setEnabled(tonesEnabled);
  }, [tonesEnabled]);

  useEffect(() => {
    const prev = prevRef.current;
    const speechParts: string[] = [];

    if (snapshot.state === 'preparing' && !announcedStartRef.current) {
      announcedStartRef.current = true;
      speechParts.push('Workout starting.');
    }

    if (snapshot.state === 'preparing' && snapshot.remainingMs !== null) {
      const wholeSecond = Math.ceil(snapshot.remainingMs / 1000);
      if (wholeSecond > 0 && wholeSecond <= 5 && wholeSecond !== lastCountdownSecondRef.current) {
        lastCountdownSecondRef.current = wholeSecond;
        speechParts.push(String(wholeSecond));
      }
    }

    const isTimedState = snapshot.state === 'exercise' || snapshot.state === 'rest' || snapshot.state === 'roundRest';
    const enteredNewSegment = isTimedState && (!prev || prev.segmentIndex !== snapshot.segmentIndex || prev.state !== snapshot.state);

    if (enteredNewSegment && snapshot.currentSegment) {
      lastCountdownSecondRef.current = null;
      const roundChanged = snapshot.state === 'exercise' && snapshot.roundNumber !== null && snapshot.roundNumber !== prev?.roundNumber;
      const base = buildSegmentAnnouncement(snapshot.currentSegment, settings, snapshot.nextSegment);
      speechParts.push(roundChanged ? `Round ${snapshot.roundNumber}. ${base}` : base);
      if (snapshot.state === 'exercise') toneController.playExerciseStart();
      else toneController.playRestStart();
    } else if (isTimedState && !snapshot.isManualAdvance && snapshot.remainingMs !== null) {
      const threshold = countdownThresholdSeconds(settings.countdownAnnouncements);
      const wholeSecond = Math.ceil(snapshot.remainingMs / 1000);
      if (threshold > 0 && wholeSecond >= 1 && wholeSecond <= threshold && wholeSecond !== lastCountdownSecondRef.current) {
        lastCountdownSecondRef.current = wholeSecond;
        speechParts.push(String(wholeSecond));
      }
    }

    if (snapshot.state === 'complete' && prev?.state !== 'complete') {
      speechParts.push('Workout complete.');
      toneController.playWorkoutComplete();
    }

    if (speechParts.length > 0) {
      speechController.speak(speechParts.join(' '));
    }

    prevRef.current = { segmentIndex: snapshot.segmentIndex, state: snapshot.state, roundNumber: snapshot.roundNumber };
  });
}
