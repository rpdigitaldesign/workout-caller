/**
 * Calendar grid math, deliberately implemented on raw Y/M/D integers via
 * `Date.UTC` rather than plain `new Date(...)`/date-fns local-time
 * functions. A calendar date is not an instant — it must not shift
 * because of the server or browser's own timezone. Every function here
 * takes and returns plain "YYYY-MM-DD" strings.
 */

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
}

export type WeekStartsOn = 0 | 1; // 0 = Sunday, 1 = Monday

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m, d));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

interface YMD {
  y: number;
  m: number; // 0-indexed
  d: number;
}

function addDaysYMD(ymd: YMD, delta: number): YMD {
  const date = new Date(Date.UTC(ymd.y, ymd.m, ymd.d));
  date.setUTCDate(date.getUTCDate() + delta);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
}

function dayOfWeekYMD(ymd: YMD): number {
  return new Date(Date.UTC(ymd.y, ymd.m, ymd.d)).getUTCDay();
}

export function parseDateOnly(dateStr: string): YMD {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y: y!, m: m! - 1, d: d! };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Full weeks of CalendarDay covering `month` (0-indexed), including
 * leading/trailing days from adjacent months so every week row has 7 days.
 */
export function getMonthGrid(
  year: number,
  month: number,
  todayDateStr: string,
  weekStartsOn: WeekStartsOn = 0,
): CalendarDay[][] {
  const firstWeekday = dayOfWeekYMD({ y: year, m: month, d: 1 });
  const leadingCount = (firstWeekday - weekStartsOn + 7) % 7;
  const start = addDaysYMD({ y: year, m: month, d: 1 }, -leadingCount);

  const totalDaysInMonth = daysInMonth(year, month);
  const totalCells = Math.ceil((leadingCount + totalDaysInMonth) / 7) * 7;

  const days: CalendarDay[] = [];
  let cursor = start;
  for (let i = 0; i < totalCells; i++) {
    const dateStr = toDateStr(cursor.y, cursor.m, cursor.d);
    days.push({
      date: dateStr,
      isCurrentMonth: cursor.m === month && cursor.y === year,
      isToday: dateStr === todayDateStr,
    });
    cursor = addDaysYMD(cursor, 1);
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

/** The 7 days of the week containing `dateStr`. */
export function getWeekDays(
  dateStr: string,
  todayDateStr: string,
  weekStartsOn: WeekStartsOn = 0,
): CalendarDay[] {
  const ymd = parseDateOnly(dateStr);
  const weekday = dayOfWeekYMD(ymd);
  const offset = (weekday - weekStartsOn + 7) % 7;
  const start = addDaysYMD(ymd, -offset);

  const days: CalendarDay[] = [];
  let cursor = start;
  for (let i = 0; i < 7; i++) {
    const ds = toDateStr(cursor.y, cursor.m, cursor.d);
    days.push({ date: ds, isCurrentMonth: true, isToday: ds === todayDateStr });
    cursor = addDaysYMD(cursor, 1);
  }
  return days;
}

export function addDaysToDateStr(dateStr: string, delta: number): string {
  const result = addDaysYMD(parseDateOnly(dateStr), delta);
  return toDateStr(result.y, result.m, result.d);
}

/** Splits a day's items into what's shown directly and an overflow count ("3 workouts") past `max`. */
export function splitForOverflow<T>(items: T[], max: number): { visible: T[]; overflowCount: number } {
  if (items.length <= max) return { visible: items, overflowCount: 0 };
  return { visible: items.slice(0, max), overflowCount: items.length - max };
}
