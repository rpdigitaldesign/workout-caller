import { get, set } from 'idb-keyval';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateSessionInput } from '@/lib/database/sessions';
import { createSession } from '@/lib/database/sessions';
import { markScheduledWorkoutCompleted } from '@/lib/database/scheduled';

const PENDING_SESSIONS_KEY = 'workout-caller:pending-sessions';

export interface PendingSession {
  localId: string;
  input: CreateSessionInput;
  createdAt: string;
}

async function readQueue(): Promise<PendingSession[]> {
  return (await get<PendingSession[]>(PENDING_SESSIONS_KEY)) ?? [];
}

async function writeQueue(queue: PendingSession[]): Promise<void> {
  await set(PENDING_SESSIONS_KEY, queue);
}

/**
 * Called when a workout finishes. Always writes locally first — if the
 * Supabase write also succeeds immediately, the entry is removed right
 * away; if it fails (offline, transient error), the entry stays queued
 * and a completed workout is never lost to a network blip.
 */
export async function completeWorkoutSession(
  client: SupabaseClient,
  input: CreateSessionInput,
): Promise<{ synced: boolean }> {
  const localId = crypto.randomUUID();
  const entry: PendingSession = { localId, input, createdAt: new Date().toISOString() };

  const queue = await readQueue();
  await writeQueue([...queue, entry]);

  const synced = await trySyncOne(client, entry);
  return { synced };
}

async function trySyncOne(client: SupabaseClient, entry: PendingSession): Promise<boolean> {
  try {
    const session = await createSession(client, entry.input);
    if (entry.input.scheduledWorkoutId) {
      await markScheduledWorkoutCompleted(client, entry.input.scheduledWorkoutId, session.id);
    }
    await removePendingSession(entry.localId);
    return true;
  } catch {
    return false;
  }
}

export async function listPendingSessions(): Promise<PendingSession[]> {
  return readQueue();
}

export async function removePendingSession(localId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((e) => e.localId !== localId));
}

/** Call on reconnect (e.g. from the `online` event) to flush anything still queued. */
export async function flushPendingSessions(client: SupabaseClient): Promise<{ succeeded: number; remaining: number }> {
  const queue = await readQueue();
  let succeeded = 0;
  for (const entry of queue) {
    if (await trySyncOne(client, entry)) succeeded++;
  }
  const remaining = (await readQueue()).length;
  return { succeeded, remaining };
}
