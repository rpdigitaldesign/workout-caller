import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import { resolveNaturalLanguageDate } from '@/lib/dates/dates';

const NY = 'America/New_York';
const TOKYO = 'Asia/Tokyo';

// A fixed reference instant: 2026-06-15 is a Monday.
const MONDAY_NOON_UTC = '2026-06-15T16:00:00.000Z'; // noon in America/New_York (UTC-4 in June)

describe('resolveNaturalLanguageDate', () => {
  it('resolves "today"', () => {
    const r = resolveNaturalLanguageDate('today', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r).toEqual({ ok: true, result: { date: '2026-06-15', time: null } });
  });

  it('resolves "tomorrow"', () => {
    const r = resolveNaturalLanguageDate('tomorrow', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r).toEqual({ ok: true, result: { date: '2026-06-16', time: null } });
  });

  it('resolves "yesterday"', () => {
    const r = resolveNaturalLanguageDate('yesterday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r).toEqual({ ok: true, result: { date: '2026-06-14', time: null } });
  });

  it('resolves a bare weekday to its upcoming occurrence, including today if it matches', () => {
    const monday = resolveNaturalLanguageDate('monday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(monday).toEqual({ ok: true, result: { date: '2026-06-15', time: null } }); // today
    const saturday = resolveNaturalLanguageDate('saturday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(saturday).toEqual({ ok: true, result: { date: '2026-06-20', time: null } });
  });

  it('resolves "this <weekday>" the same as a bare weekday', () => {
    const r = resolveNaturalLanguageDate('this saturday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r).toEqual({ ok: true, result: { date: '2026-06-20', time: null } });
  });

  it('resolves "next <weekday>" to the following week, even when today is that weekday', () => {
    const nextMonday = resolveNaturalLanguageDate('next monday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(nextMonday).toEqual({ ok: true, result: { date: '2026-06-22', time: null } });
    const nextSaturday = resolveNaturalLanguageDate('next saturday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(nextSaturday).toEqual({ ok: true, result: { date: '2026-06-27', time: null } });
  });

  it('resolves "last <weekday>" to the most recent past occurrence, a week ago if today is that weekday', () => {
    const lastSaturday = resolveNaturalLanguageDate('last saturday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(lastSaturday).toEqual({ ok: true, result: { date: '2026-06-13', time: null } });
    const lastMonday = resolveNaturalLanguageDate('last monday', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(lastMonday).toEqual({ ok: true, result: { date: '2026-06-08', time: null } }); // a week ago, not today
  });

  it('resolves "N <weekday>s ago"', () => {
    const oneThursdayAgo = resolveNaturalLanguageDate('1 thursdays ago', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    // Most recent past Thursday relative to Monday 2026-06-15 is 2026-06-11.
    expect(oneThursdayAgo).toEqual({ ok: true, result: { date: '2026-06-11', time: null } });

    const twoThursdaysAgo = resolveNaturalLanguageDate('two thursdays ago', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(twoThursdaysAgo).toEqual({ ok: true, result: { date: '2026-06-04', time: null } });
  });

  it('resolves an explicit month/day, rolling to next year if the date has already passed this year', () => {
    const upcoming = resolveNaturalLanguageDate('September 18', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(upcoming).toEqual({ ok: true, result: { date: '2026-09-18', time: null } });

    const past = resolveNaturalLanguageDate('January 5', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(past).toEqual({ ok: true, result: { date: '2027-01-05', time: null } });
  });

  it('resolves an explicit month/day/year exactly, never rolling the year', () => {
    const r = resolveNaturalLanguageDate('January 5 2025', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r).toEqual({ ok: true, result: { date: '2025-01-05', time: null } });
  });

  it('extracts a clock time alongside a date phrase', () => {
    const r = resolveNaturalLanguageDate('Saturday at 7am', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r).toEqual({ ok: true, result: { date: '2026-06-20', time: '07:00' } });

    const r2 = resolveNaturalLanguageDate('tomorrow 9:30pm', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r2).toEqual({ ok: true, result: { date: '2026-06-16', time: '21:30' } });
  });

  it('handles 12am/12pm correctly', () => {
    const midnight = resolveNaturalLanguageDate('today 12am', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(midnight.ok && midnight.result.time).toBe('00:00');
    const noon = resolveNaturalLanguageDate('today 12pm', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(noon.ok && noon.result.time).toBe('12:00');
  });

  it('returns ok:false for unrecognized phrases rather than guessing', () => {
    const r = resolveNaturalLanguageDate('sometime soonish', { nowISO: MONDAY_NOON_UTC, timeZone: NY });
    expect(r.ok).toBe(false);
  });

  it('resolves the same instant to different calendar dates depending on timezone (timezone-safety)', () => {
    // Late evening in New York is already the next day in Tokyo.
    const lateEveningUTC = '2026-06-15T02:30:00.000Z'; // 2026-06-14 22:30 in New York (UTC-4); 2026-06-15 11:30 in Tokyo (UTC+9)
    const ny = resolveNaturalLanguageDate('today', { nowISO: lateEveningUTC, timeZone: NY });
    const tokyo = resolveNaturalLanguageDate('today', { nowISO: lateEveningUTC, timeZone: TOKYO });
    expect(ny).toEqual({ ok: true, result: { date: '2026-06-14', time: null } });
    expect(tokyo).toEqual({ ok: true, result: { date: '2026-06-15', time: null } });
  });

  it('never skips or duplicates a day across a DST transition', () => {
    // Find the US spring-forward Sunday in March 2026 by scanning (second Sunday of March).
    let dstSunday = new Date(Date.UTC(2026, 2, 1, 12));
    let sundaysSeen = 0;
    while (sundaysSeen < 2) {
      if (dstSunday.getUTCDay() === 0) sundaysSeen++;
      if (sundaysSeen < 2) dstSunday = addDays(dstSunday, 1);
    }
    const dayBeforeNoonUTC = addDays(dstSunday, -1).toISOString().slice(0, 10) + 'T16:00:00.000Z';

    const day0 = resolveNaturalLanguageDate('today', { nowISO: dayBeforeNoonUTC, timeZone: NY });
    const day1 = resolveNaturalLanguageDate('tomorrow', { nowISO: dayBeforeNoonUTC, timeZone: NY });
    expect(day0.ok && day1.ok).toBe(true);
    if (day0.ok && day1.ok) {
      const d0 = new Date(day0.result.date + 'T00:00:00Z');
      const d1 = new Date(day1.result.date + 'T00:00:00Z');
      expect((d1.getTime() - d0.getTime()) / (24 * 60 * 60 * 1000)).toBe(1);
    }
  });
});
