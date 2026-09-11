import type { CalendarDay } from '@/lib/calendar/calendar';
import { splitForOverflow } from '@/lib/calendar/calendar';
import { STATUS_ICON, type CalendarItem } from '@/lib/calendar/items';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthGrid({
  weeks,
  itemsByDate,
  onDayClick,
}: {
  weeks: CalendarDay[][];
  itemsByDate: Map<string, CalendarItem[]>;
  onDayClick: (date: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-1 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day) => {
            const items = itemsByDate.get(day.date) ?? [];
            const { visible, overflowCount } = splitForOverflow(items, 2);
            return (
              <button
                key={day.date}
                onClick={() => onDayClick(day.date)}
                className={`focus-ring flex min-h-20 flex-col items-start gap-0.5 border-b border-r border-border p-1.5 text-left last:border-r-0 sm:min-h-24 ${
                  day.isCurrentMonth ? '' : 'opacity-40'
                }`}
              >
                <span
                  className={`text-xs font-semibold ${day.isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black' : ''}`}
                >
                  {Number(day.date.slice(-2))}
                </span>
                {visible.map((item) => (
                  <span key={item.id} className="w-full truncate text-[11px] text-text-muted">
                    {STATUS_ICON[item.status]} {item.title}
                  </span>
                ))}
                {overflowCount > 0 && <span className="text-[11px] text-text-muted">+{overflowCount} more</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
