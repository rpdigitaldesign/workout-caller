'use client';

import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

export interface ScheduleSheetProps {
  open: boolean;
  workoutTitle: string;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onConfirm: (input: { date: string; time: string | null; notes: string | null }) => Promise<void> | void;
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ScheduleSheet({ open, workoutTitle, defaultDate, onClose, onConfirm }: ScheduleSheetProps) {
  const [date, setDate] = useState(defaultDate ?? todayDateStr());
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({ date, time: time === '' ? null : time, notes: notes.trim() === '' ? null : notes.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title={`Schedule "${workoutTitle}"`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">
            Time (optional)
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-text-muted">
            Notes (optional)
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gym before work, hotel gym, use dumbbells..."
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? 'Scheduling…' : 'Schedule'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
