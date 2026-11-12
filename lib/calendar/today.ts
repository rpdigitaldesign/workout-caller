/**
 * Today's date on the person's own calendar, as YYYY-MM-DD.
 *
 * Never use `new Date().toISOString().slice(0, 10)` for this: that is the UTC
 * date, which in the evening (e.g. 8pm in New York) is already tomorrow.
 */
export function localDateStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
