import { v4 as uuid } from 'uuid';
import type { Workout } from './schema';

export function blankWorkout(): Workout {
  return {
    title: '',
    rounds: 1,
    roundRestSeconds: null,
    postWarmupRestSeconds: null,
    preCooldownRestSeconds: null,
    warmup: [],
    steps: [
      {
        id: uuid(),
        type: 'exercise',
        name: '',
        durationSeconds: 30,
        reps: null,
        notes: null,
        announce: null,
      },
    ],
    cooldown: [],
    notes: null,
    tags: [],
  };
}
