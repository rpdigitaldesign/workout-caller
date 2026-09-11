import type { CalendarDay } from '@/lib/calendar/calendar';
import { STATUS_ICON, type CalendarItem } from '@/lib/calendar/items';

export function WeekView({
  days,
  itemsByDate,
  onDayClick,
}: {
  days: CalendarDay[];
  itemsByDate: Map<string, CalendarItem[]>;
  onDayClick: (date: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {days.map((day) => {
        const items = itemsByDate.get(day.date) ?? [];
        const label = new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
        return (
          <button
            key={day.date}
            onClick={() => onDayClick(day.date)}
            className="focus-ring rounded-xl border border-border bg-surface p-3 text-left"
          >
            <p className={`text-sm font-semibold ${day.isToday ? 'text-accent' : ''}`}>{label}</p>
            {items.length === 0 && <p className="mt-1 text-sm text-text-muted">Nothing</p>}
            {items.map((item) => (
              <p key={item.id} className="mt-1 text-sm text-text-muted">
                {STATUS_ICON[item.status]} {item.title}
                {item.time ? ` · ${item.time}` : ''}
              </p>
            ))}
          </button>
        );
      })}
    </div>
  );
}
