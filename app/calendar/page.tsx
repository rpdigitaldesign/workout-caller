'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { WeekView } from '@/components/calendar/WeekView';
import { AgendaView } from '@/components/calendar/AgendaView';
import { CopyWeekPreview } from '@/components/calendar/CopyWeekPreview';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { listScheduledWorkoutsBetween } from '@/lib/database/scheduled';
import { listSessionsBetween } from '@/lib/database/sessions';
import { scheduleWorkout } from '@/lib/database/scheduled';
import { getMonthGrid, getWeekDays, addDaysToDateStr, parseDateOnly } from '@/lib/calendar/calendar';
import { buildCalendarItems, type CalendarItem, type CalendarItemStatus } from '@/lib/calendar/items';
import { mapWeekCopy, type CopyWeekMapping } from '@/lib/calendar/copyWeek';
import type { ScheduledWorkout } from '@/lib/workout/schema';

type ViewMode = 'month' | 'week' | 'agenda';
type Filter = 'all' | CalendarItemStatus;

function todayDateStr(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

export default function CalendarPage() {
  const user = useAuthUser();
  const router = useRouter();
  const today = todayDateStr();
  const [view, setView] = useState<ViewMode>('month');
  const [filter, setFilter] = useState<Filter>('all');
  const [cursorDate, setCursorDate] = useState(today);
  const [dataVersion, setDataVersion] = useState(0);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [copyMappings, setCopyMappings] = useState<CopyWeekMapping[]>([]);
  const [copySourceById, setCopySourceById] = useState<Map<string, ScheduledWorkout>>(new Map());

  const cursor = parseDateOnly(cursorDate);
  const weeks = useMemo(() => getMonthGrid(cursor.y, cursor.m, today, 0), [cursor.y, cursor.m, today]);
  const weekDays = useMemo(() => getWeekDays(cursorDate, today, 0), [cursorDate, today]);

  const rangeStart = view === 'month' ? weeks[0]![0]!.date : weekDays[0]!.date;
  const rangeEnd = view === 'month' ? weeks[weeks.length - 1]![6]!.date : weekDays[6]!.date;

  const [itemsByDate, setItemsByDate] = useState<Map<string, CalendarItem[]>>(new Map());

  useEffect(() => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    void Promise.all([
      listScheduledWorkoutsBetween(client, user.id, rangeStart, rangeEnd),
      listSessionsBetween(client, user.id, `${rangeStart}T00:00:00.000Z`, `${rangeEnd}T23:59:59.999Z`),
    ]).then(([scheduled, sessions]) => {
      setItemsByDate(buildCalendarItems(scheduled, sessions));
    });
  }, [user, rangeStart, rangeEnd, dataVersion]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return itemsByDate;
    const filtered = new Map<string, CalendarItem[]>();
    for (const [date, items] of itemsByDate.entries()) {
      const kept = items.filter((i) => i.status === filter);
      if (kept.length > 0) filtered.set(date, kept);
    }
    return filtered;
  }, [itemsByDate, filter]);

  const handleDayClick = (date: string) => {
    router.push(`/calendar/day/${date}`);
  };

  const handleCopyLastWeek = async () => {
    if (!user) return;
    const client = createSupabaseBrowserClient();
    const thisWeekStart = getWeekDays(today, today, 0)[0]!.date;
    const lastWeekStart = addDaysToDateStr(thisWeekStart, -7);
    const lastWeekEnd = addDaysToDateStr(thisWeekStart, -1);
    const sourceItems = await listScheduledWorkoutsBetween(client, user.id, lastWeekStart, lastWeekEnd);
    const mappings = mapWeekCopy(
      sourceItems.map((s) => ({ id: s.id, scheduledDate: s.scheduledDate, scheduledTime: s.scheduledTime, title: s.title })),
      7,
    );
    setCopySourceById(new Map(sourceItems.map((s) => [s.id, s])));
    setCopyMappings(mappings);
    setCopyWeekOpen(true);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button variant="secondary" onClick={handleCopyLastWeek}>
          Copy Last Week
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['month', 'week', 'agenda'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`focus-ring rounded-lg px-3 py-1.5 text-sm capitalize ${view === v ? 'bg-accent text-black' : 'bg-surface-raised text-text-muted'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {view !== 'agenda' && (
          <div className="flex items-center gap-2">
            <button
              className="focus-ring rounded-lg px-3 py-1.5 text-text-muted hover:text-text"
              onClick={() => setCursorDate(addDaysToDateStr(cursorDate, view === 'month' ? -30 : -7))}
            >
              ←
            </button>
            <span className="text-sm font-semibold">
              {new Date(cursorDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button
              className="focus-ring rounded-lg px-3 py-1.5 text-text-muted hover:text-text"
              onClick={() => setCursorDate(addDaysToDateStr(cursorDate, view === 'month' ? 30 : 7))}
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'scheduled', 'completed', 'partial', 'skipped'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`focus-ring rounded-full px-3 py-1 text-xs capitalize ${filter === f ? 'bg-accent text-black' : 'bg-surface-raised text-text-muted'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {view === 'month' && <MonthGrid weeks={weeks} itemsByDate={filteredItems} onDayClick={handleDayClick} />}
      {view === 'week' && <WeekView days={weekDays} itemsByDate={filteredItems} onDayClick={handleDayClick} />}
      {view === 'agenda' && <AgendaView itemsByDate={filteredItems} onDayClick={handleDayClick} />}

      <CopyWeekPreview
        open={copyWeekOpen}
        mappings={copyMappings}
        onClose={() => setCopyWeekOpen(false)}
        onConfirm={async (selected) => {
          if (!user) return;
          const client = createSupabaseBrowserClient();
          for (const m of selected) {
            const source = copySourceById.get(m.sourceId);
            if (!source) continue;
            await scheduleWorkout(client, {
              userId: user.id,
              templateId: source.templateId,
              workoutSnapshot: source.workoutSnapshot,
              title: m.title,
              scheduledDate: m.destinationDate,
              scheduledTime: m.scheduledTime,
            });
          }
          setDataVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
