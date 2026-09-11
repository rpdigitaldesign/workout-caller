import { toZonedTime } from 'date-fns-tz';
import { addDays, format, getDay, parse, startOfDay } from 'date-fns';

/**
 * Deterministic, timezone-safe date handling. Never relies on naive
 * `new Date(someString)` parsing — every entry point here takes an
 * explicit `timeZone` and resolves calendar dates/times as wall-clock
 * values in that zone, not in UTC or the server's own zone.
 *
 * `toZonedTime` returns a Date whose *local* (system) getters read back
 * the wall-clock time in `timeZone`, regardless of the server's actual
 * timezone. That lets the rest of this module use plain date-fns
 * functions (startOfDay, addDays, getDay, format) directly on the result
 * and get correct answers for the target zone.
 */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export interface ResolveDateOptions {
  /** An absolute instant, e.g. `new Date().toISOString()` captured on the client. */
  nowISO: string;
  /** IANA timezone, e.g. "America/New_York". Must come from the client (`Intl.DateTimeFormat().resolvedOptions().timeZone`), never assumed. */
  timeZone: string;
}

export interface ResolvedDate {
  /** YYYY-MM-DD, safe to store directly in a Postgres `date` column. */
  date: string;
  /** HH:MM (24h), or null if no explicit time was present in the text. */
  time: string | null;
}

export type DateResolution = { ok: true; result: ResolvedDate } | { ok: false; reason: string };

export function zonedNow(options: ResolveDateOptions): Date {
  return toZonedTime(new Date(options.nowISO), options.timeZone);
}

export function formatDateOnly(zonedDate: Date): string {
  return format(zonedDate, 'yyyy-MM-dd');
}

export function formatTimeOnly(zonedDate: Date): string {
  return format(zonedDate, 'HH:mm');
}

function extractClockTime(text: string): { time: string | null; remainder: string } {
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return { time: null, remainder: text };
  const rawHour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]!.toLowerCase();
  if (rawHour < 1 || rawHour > 12 || minute > 59) return { time: null, remainder: text };
  let hour = rawHour % 12;
  if (meridiem === 'pm') hour += 12;
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const remainder = (text.slice(0, match.index) + text.slice(match.index! + match[0].length)).trim();
  return { time, remainder };
}

const MONTH_DAY_FORMATS = ['MMMM d yyyy', 'MMMM d', 'MMM d yyyy', 'MMM d', 'M/d/yyyy', 'M/d', 'yyyy-MM-dd'];

const COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCountWord(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  return COUNT_WORDS[text] ?? null;
}

/**
 * Resolves a natural-language date/time phrase relative to the user's
 * local "now". Returns `ok:false` rather than guessing when the phrase
 * isn't recognized — callers should surface that as a clarifying question,
 * never fall back to naive Date parsing.
 *
 * Weekday convention (documented since English is genuinely ambiguous
 * here): a bare or "this"-qualified weekday means its next occurrence
 * *including today* (0-6 days out); a "next"-qualified weekday always
 * means the occurrence in the following week (7-13 days out).
 */
export function resolveNaturalLanguageDate(rawText: string, options: ResolveDateOptions): DateResolution {
  const today = startOfDay(zonedNow(options));
  const { time, remainder } = extractClockTime(rawText);
  const text = remainder
    .toLowerCase()
    .replace(/\bat\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text === '' || text === 'today') {
    return { ok: true, result: { date: formatDateOnly(today), time } };
  }
  if (text === 'tomorrow') {
    return { ok: true, result: { date: formatDateOnly(addDays(today, 1)), time } };
  }
  if (text === 'yesterday') {
    return { ok: true, result: { date: formatDateOnly(addDays(today, -1)), time } };
  }

  const inDaysMatch = text.match(/^in (\d+) days?$/);
  if (inDaysMatch) {
    const n = Number(inDaysMatch[1]);
    return { ok: true, result: { date: formatDateOnly(addDays(today, n)), time } };
  }

  const weekdayMatch = text.match(/^(next |this |last )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (weekdayMatch) {
    const qualifier = weekdayMatch[1]?.trim();
    const targetIdx = WEEKDAYS.indexOf(weekdayMatch[2] as (typeof WEEKDAYS)[number]);
    const todayIdx = getDay(today);
    if (qualifier === 'last') {
      // The most recent PAST occurrence — if today is that weekday, "last X" means a week ago, not today.
      const diff = (todayIdx - targetIdx + 7) % 7 || 7;
      return { ok: true, result: { date: formatDateOnly(addDays(today, -diff)), time } };
    }
    let diff = (targetIdx - todayIdx + 7) % 7;
    if (qualifier === 'next') diff += 7;
    return { ok: true, result: { date: formatDateOnly(addDays(today, diff)), time } };
  }

  const agoMatch = text.match(
    /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten) (sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays) ago$/,
  );
  if (agoMatch) {
    const n = parseCountWord(agoMatch[1]!);
    const weekdayPlural = agoMatch[2]!;
    const targetIdx = WEEKDAYS.indexOf(weekdayPlural.slice(0, -1) as (typeof WEEKDAYS)[number]);
    const todayIdx = getDay(today);
    if (n !== null && targetIdx >= 0) {
      const lastOccurrenceDiff = (todayIdx - targetIdx + 7) % 7 || 7;
      const totalDaysBack = lastOccurrenceDiff + (n - 1) * 7;
      return { ok: true, result: { date: formatDateOnly(addDays(today, -totalDaysBack)), time } };
    }
  }

  for (const fmt of MONTH_DAY_FORMATS) {
    const parsed = parse(text, fmt, today);
    const withinPlausibleRange = !Number.isNaN(parsed.getTime()) && Math.abs(parsed.getFullYear() - today.getFullYear()) <= 1;
    if (withinPlausibleRange) {
      // Year-less formats: if the parsed date is more than a day in the past, assume next year.
      const needsYear = !fmt.includes('yyyy');
      let resolved = parsed;
      if (needsYear && resolved < addDays(today, -1)) {
        resolved = new Date(resolved.getFullYear() + 1, resolved.getMonth(), resolved.getDate());
      }
      return { ok: true, result: { date: formatDateOnly(resolved), time } };
    }
  }

  return { ok: false, reason: `Could not resolve a date from "${rawText}".` };
}
