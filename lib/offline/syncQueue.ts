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

const SYNC_LOCK_NAME = 'workout-caller:sync-sessions';
let syncChain: Promise<unknown> = Promise.resolve();

/**
 * Runs one sync job at a time. Several things can try to sync at once (a workout
 * just finished, the app came back online, the app was reopened, a second tab),
 * and without this two of them could both upload the same finished workout and
 * create a duplicate in history. Jobs run one after another in this tab, and the
 * Web Locks API (where available) extends that across tabs.
 */
function withSyncLock<T>(job: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const exclusive = async (): Promise<T> => {
    if (!locks) return job();
    return (await locks.request(SYNC_LOCK_NAME, () => job())) as T;
  };
  const next = syncChain.then(exclusive, exclusive);
  syncChain = next.catch(() => undefined);
  return next;
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

  const synced = await withSyncLock(() => trySyncOne(client, entry));
  return { synced };
}

/**
 * Uploads one queued workout. Must run inside withSyncLock. It first checks the
 * entry is still queued: if another sync already uploaded it, it is not uploaded
 * again (that would be a duplicate in history).
 */
async function trySyncOne(client: SupabaseClient, entry: PendingSession): Promise<boolean> {
  const stillQueued = (await readQueue()).some((e) => e.localId === entry.localId);
  if (!stillQueued) return true; // already uploaded by an earlier sync
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

/** Uploads everything still queued (one at a time, never concurrently with another sync). Safe to call whenever. */
export function flushPendingSessions(client: SupabaseClient): Promise<{ succeeded: number; remaining: number }> {
  return withSyncLock(async () => {
    const queue = await readQueue();
    let succeeded = 0;
    for (const entry of queue) {
      if (await trySyncOne(client, entry)) succeeded++;
    }
    const remaining = (await readQueue()).length;
    return { succeeded, remaining };
  });
}
