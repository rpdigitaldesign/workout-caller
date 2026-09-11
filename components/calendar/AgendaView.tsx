import { STATUS_ICON, STATUS_LABEL, type CalendarItem } from '@/lib/calendar/items';

export function AgendaView({
  itemsByDate,
  onDayClick,
}: {
  itemsByDate: Map<string, CalendarItem[]>;
  onDayClick: (date: string) => void;
}) {
  const dates = Array.from(itemsByDate.keys()).sort();

  if (dates.length === 0) {
    return <p className="text-text-muted">Nothing in this range.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {dates.map((date) => (
        <button
          key={date}
          onClick={() => onDayClick(date)}
          className="focus-ring rounded-xl border border-border bg-surface p-3 text-left"
        >
          <p className="text-sm font-semibold">
            {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          {(itemsByDate.get(date) ?? []).map((item) => (
            <p key={item.id} className="mt-1 text-sm text-text-muted">
              {STATUS_ICON[item.status]} {item.title} · {STATUS_LABEL[item.status]}
              {item.time ? ` · ${item.time}` : ''}
            </p>
          ))}
        </button>
      ))}
    </div>
  );
}
