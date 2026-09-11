'use client';

import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import type { CopyWeekMapping } from '@/lib/calendar/copyWeek';

export function CopyWeekPreview({
  open,
  mappings,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mappings: CopyWeekMapping[];
  onClose: () => void;
  onConfirm: (selected: CopyWeekMapping[]) => Promise<void> | void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(mappings.map((m) => m.sourceId)));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(mappings.filter((m) => selectedIds.has(m.sourceId)));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title="Copy last week's schedule" onClose={onClose}>
      {mappings.length === 0 && <p className="text-sm text-text-muted">Nothing scheduled last week.</p>}
      <div className="flex flex-col gap-2">
        {mappings.map((m) => (
          <label
            key={m.sourceId}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
          >
            <input type="checkbox" checked={selectedIds.has(m.sourceId)} onChange={() => toggle(m.sourceId)} />
            <div>
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-xs text-text-muted">
                {m.sourceDate} → {m.destinationDate}
                {m.scheduledTime ? ` at ${m.scheduledTime}` : ''}
              </p>
            </div>
          </label>
        ))}
      </div>
      {mappings.length > 0 && (
        <div className="mt-4 flex gap-3">
          <Button onClick={handleConfirm} disabled={saving || selectedIds.size === 0}>
            {saving ? 'Copying…' : `Copy ${selectedIds.size} workout${selectedIds.size === 1 ? '' : 's'}`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}
    </Sheet>
  );
}
