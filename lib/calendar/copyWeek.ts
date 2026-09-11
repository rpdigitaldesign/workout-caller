import { addDaysToDateStr } from './calendar';

export interface CopyWeekSourceItem {
  id: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string | null;
  title: string;
}

export interface CopyWeekMapping {
  sourceId: string;
  sourceDate: string;
  destinationDate: string;
  scheduledTime: string | null;
  title: string;
  /** User can deselect individual items in the preview before confirming — defaults to true. */
  selected: boolean;
}

/**
 * Maps each source item to a destination date shifted by `dayOffset` days
 * (7 for "repeat last week" / "copy to next week", -7 for "copy from next
 * week back"), preserving each item's day-of-week and time-of-day. Never
 * writes anything itself — the caller shows this as a deselectable
 * preview and only creates ScheduledWorkout rows after explicit
 * confirmation.
 */
export function mapWeekCopy(items: CopyWeekSourceItem[], dayOffset: number): CopyWeekMapping[] {
  return items.map((item) => ({
    sourceId: item.id,
    sourceDate: item.scheduledDate,
    destinationDate: addDaysToDateStr(item.scheduledDate, dayOffset),
    scheduledTime: item.scheduledTime,
    title: item.title,
    selected: true,
  }));
}
