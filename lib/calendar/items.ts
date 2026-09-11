import type { ScheduledWorkout, WorkoutSession } from '@/lib/workout/schema';

export type CalendarItemStatus = 'scheduled' | 'completed' | 'partial' | 'skipped' | 'cancelled';

export interface CalendarItem {
  id: string;
  kind: 'scheduled' | 'session';
  title: string;
  date: string; // YYYY-MM-DD, local calendar date
  time: string | null;
  status: CalendarItemStatus;
}

function localDateOnly(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function localTimeOnly(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/**
 * Merges ScheduledWorkout + WorkoutSession rows into one calendar-item
 * list per date. A scheduled workout that has already been completed is
 * represented by its resulting session instead (which carries the real
 * start time and duration) — not shown twice.
 */
export function buildCalendarItems(scheduled: ScheduledWorkout[], sessions: WorkoutSession[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  const push = (date: string, item: CalendarItem) => {
    const list = map.get(date) ?? [];
    list.push(item);
    map.set(date, list);
  };

  for (const s of scheduled) {
    if (s.status === 'completed') continue; // represented by its session instead
    push(s.scheduledDate, {
      id: s.id,
      kind: 'scheduled',
      title: s.title,
      date: s.scheduledDate,
      time: s.scheduledTime,
      status: s.status,
    });
  }

  for (const s of sessions) {
    const date = localDateOnly(s.startedAt);
    push(date, {
      id: s.id,
      kind: 'session',
      title: s.title,
      date,
      time: localTimeOnly(s.startedAt),
      status: s.status === 'completed' ? 'completed' : s.status === 'partial' ? 'partial' : 'cancelled',
    });
  }

  for (const list of map.values()) {
    list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }
  return map;
}

export const STATUS_LABEL: Record<CalendarItemStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  partial: 'Partial',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export const STATUS_ICON: Record<CalendarItemStatus, string> = {
  scheduled: '○',
  completed: '✓',
  partial: '◐',
  skipped: '⤫',
  cancelled: '⤫',
};
