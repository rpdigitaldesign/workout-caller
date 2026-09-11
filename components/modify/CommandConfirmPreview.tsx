'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DiffPreview } from './DiffPreview';
import type { CommandPreview } from '@/lib/commands/executeCommand';
import type { ResolvedReference } from '@/lib/database/search';

export interface CommandConfirmPreviewProps {
  preview: CommandPreview;
  onChoose: (choice: ResolvedReference) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function CommandConfirmPreview({ preview, onChoose, onConfirm, onCancel, confirming }: CommandConfirmPreviewProps) {
  if (preview.kind === 'not_found') {
    return (
      <Card>
        <p className="text-text-muted">Couldn&apos;t find a matching workout for that.</p>
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Dismiss
        </Button>
      </Card>
    );
  }

  if (preview.kind === 'date_unresolved') {
    return (
      <Card>
        <p className="text-text-muted">{preview.reason} Try phrasing the date differently (e.g. &quot;Saturday&quot;, &quot;September 18&quot;).</p>
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Dismiss
        </Button>
      </Card>
    );
  }

  if (preview.kind === 'ai_error') {
    return (
      <Card>
        <p className="text-danger">{preview.message}</p>
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Dismiss
        </Button>
      </Card>
    );
  }

  if (preview.kind === 'ambiguous') {
    return (
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Which one did you mean?</h2>
        <div className="flex flex-col gap-2">
          {preview.choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => onChoose(choice)}
              className="focus-ring rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-left hover:bg-border"
            >
              <p className="font-medium">{choice.title}</p>
              {choice.startedAt && <p className="text-xs text-text-muted">{new Date(choice.startedAt).toLocaleDateString()}</p>}
              {choice.scheduledDate && <p className="text-xs text-text-muted">{formatDate(choice.scheduledDate)}</p>}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Cancel
        </Button>
      </Card>
    );
  }

  if (preview.kind === 'found') {
    return (
      <Card>
        <h2 className="mb-1 text-lg font-semibold">{preview.reference.title}</h2>
        <p className="text-sm text-text-muted">
          {preview.reference.workout.rounds} round{preview.reference.workout.rounds === 1 ? '' : 's'} ·{' '}
          {preview.reference.workout.steps.length} step{preview.reference.workout.steps.length === 1 ? '' : 's'}
        </p>
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Dismiss
        </Button>
      </Card>
    );
  }

  if (preview.kind === 'modify_ready') {
    return (
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Modify &quot;{preview.reference.title}&quot;</h2>
        <DiffPreview original={preview.reference.workout} modified={preview.modified} />
        <div className="mt-4 flex gap-3">
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Saving…' : 'Save as New Template'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  if (preview.kind === 'schedule_ready') {
    return (
      <Card>
        <h2 className="mb-1 text-lg font-semibold">Schedule &quot;{preview.reference.title}&quot;</h2>
        <p className="text-text-muted">
          {formatDate(preview.date)}
          {preview.time ? ` at ${preview.time}` : ''}
        </p>
        <div className="mt-4 flex gap-3">
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Scheduling…' : 'Confirm'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  if (preview.kind === 'modify_and_schedule_ready') {
    return (
      <Card>
        <h2 className="mb-3 text-lg font-semibold">
          Modify &amp; schedule for {formatDate(preview.date)}
          {preview.time ? ` at ${preview.time}` : ''}
        </h2>
        <DiffPreview original={preview.reference.workout} modified={preview.modified} />
        <div className="mt-4 flex gap-3">
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Scheduling…' : 'Confirm'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  // reschedule_ready
  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Move &quot;{preview.title}&quot;</h2>
      <p className="text-text-muted">
        {formatDate(preview.fromDate)} → {formatDate(preview.date)}
        {preview.time ? ` at ${preview.time}` : ''}
      </p>
      <div className="mt-4 flex gap-3">
        <Button onClick={onConfirm} disabled={confirming}>
          {confirming ? 'Moving…' : 'Confirm'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
