import { describe, expect, it } from 'vitest';
import { addDaysToDateStr, getMonthGrid, getWeekDays, splitForOverflow } from '@/lib/calendar/calendar';
import { mapWeekCopy } from '@/lib/calendar/copyWeek';

describe('getMonthGrid', () => {
  it('produces full weeks of 7 days covering the whole month, with leading/trailing days from adjacent months', () => {
    // June 2026: June 1, 2026 is a Monday.
    const weeks = getMonthGrid(2026, 5, '2026-06-15', 0); // month is 0-indexed; weekStartsOn=Sunday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // First week should start on a Sunday, so it must lead in with May 31.
    expect(weeks[0]![0]!.date).toBe('2026-05-31');
    expect(weeks[0]![0]!.isCurrentMonth).toBe(false);
    // Last day of June should appear somewhere, flagged as current month.
    const juneLast = weeks.flat().find((d) => d.date === '2026-06-30');
    expect(juneLast?.isCurrentMonth).toBe(true);
  });

  it('flags today correctly and only once', () => {
    const weeks = getMonthGrid(2026, 5, '2026-06-15', 0);
    const todays = weeks.flat().filter((d) => d.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]!.date).toBe('2026-06-15');
  });

  it('respects weekStartsOn=1 (Monday)', () => {
    const weeks = getMonthGrid(2026, 5, '2026-06-15', 1);
    // June 1, 2026 is itself a Monday, so with Monday-start there should be no leading days.
    expect(weeks[0]![0]!.date).toBe('2026-06-01');
    expect(weeks[0]![0]!.isCurrentMonth).toBe(true);
  });

  it('handles a month starting mid-week and ending mid-week (February)', () => {
    // February 2026: Feb 1, 2026 is a Sunday; 2026 is not a leap year (28 days).
    const weeks = getMonthGrid(2026, 1, '2026-02-01', 0);
    const allDates = weeks.flat().map((d) => d.date);
    expect(allDates).toContain('2026-02-01');
    expect(allDates).toContain('2026-02-28');
    expect(allDates).not.toContain('2026-02-29');
  });
});

describe('getWeekDays', () => {
  it('returns the 7 days of the week containing the given date, Sunday-start', () => {
    const days = getWeekDays('2026-06-17', '2026-06-17', 0); // a Wednesday
    expect(days).toHaveLength(7);
    expect(days[0]!.date).toBe('2026-06-14'); // Sunday
    expect(days[6]!.date).toBe('2026-06-20'); // Saturday
  });

  it('respects weekStartsOn=1 (Monday)', () => {
    const days = getWeekDays('2026-06-17', '2026-06-17', 1);
    expect(days[0]!.date).toBe('2026-06-15'); // Monday
    expect(days[6]!.date).toBe('2026-06-21'); // Sunday
  });
});

describe('addDaysToDateStr', () => {
  it('adds and subtracts days across a month boundary without drifting', () => {
    expect(addDaysToDateStr('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDaysToDateStr('2026-07-01', -1)).toBe('2026-06-30');
  });

  it('adds across a year boundary', () => {
    expect(addDaysToDateStr('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('splitForOverflow', () => {
  it('returns all items with zero overflow when under the max', () => {
    expect(splitForOverflow([1, 2], 3)).toEqual({ visible: [1, 2], overflowCount: 0 });
  });

  it('truncates and reports overflow count when over the max', () => {
    expect(splitForOverflow([1, 2, 3, 4, 5], 3)).toEqual({ visible: [1, 2, 3], overflowCount: 2 });
  });
});

describe('mapWeekCopy', () => {
  it('shifts each item by dayOffset while preserving time and title, defaulting to selected', () => {
    const mapped = mapWeekCopy(
      [
        { id: 'a', scheduledDate: '2026-06-15', scheduledTime: '07:00', title: 'Upper Body' },
        { id: 'b', scheduledDate: '2026-06-17', scheduledTime: null, title: 'Mobility' },
      ],
      7,
    );
    expect(mapped).toEqual([
      { sourceId: 'a', sourceDate: '2026-06-15', destinationDate: '2026-06-22', scheduledTime: '07:00', title: 'Upper Body', selected: true },
      { sourceId: 'b', sourceDate: '2026-06-17', destinationDate: '2026-06-24', scheduledTime: null, title: 'Mobility', selected: true },
    ]);
  });

  it('supports multiple workouts landing on the same destination date', () => {
    const mapped = mapWeekCopy(
      [
        { id: 'a', scheduledDate: '2026-06-15', scheduledTime: '07:00', title: 'Upper Body' },
        { id: 'b', scheduledDate: '2026-06-15', scheduledTime: '18:00', title: 'Mobility' },
      ],
      7,
    );
    expect(mapped[0]!.destinationDate).toBe(mapped[1]!.destinationDate);
  });
});
