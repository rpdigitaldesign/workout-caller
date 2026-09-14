import { v4 as uuid } from 'uuid';
import type { Workout } from './schema';

export function blankWorkout(): Workout {
  return {
    title: '',
    rounds: 1,
    roundRestSeconds: null,
    warmup: [],
    steps: [
      {
        id: uuid(),
        name: '',
        durationSeconds: 30,
        reps: null,
        restAfterSeconds: 30,
        notes: null,
        announce: null,
      },
    ],
    cooldown: [],
    notes: null,
    tags: [],
  };
}
