'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CommandConfirmPreview } from '@/components/modify/CommandConfirmPreview';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createSupabaseBrowserClient } from '@/lib/database/supabaseClient';
import { resolveCommandPreview, buildPreviewForReference, commitCommandAction, type CommandPreview } from '@/lib/commands/executeCommand';
import { saveDraft } from '@/lib/workout/draftStore';
import type { WorkoutCommand } from '@/types/command';
import type { ParseCommandResult } from '@/types/command';
import type { ResolvedReference } from '@/lib/database/search';

function clientDateOptions() {
  return {
    nowISO: new Date().toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function CommandInput() {
  const user = useAuthUser();
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState<WorkoutCommand | null>(null);
  const [preview, setPreview] = useState<CommandPreview | null>(null);

  const reset = () => {
    setCommand(null);
    setPreview(null);
    setError(null);
    setText('');
  };

  const handleSubmit = async () => {
    if (!user || text.trim() === '') return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const result = (await response.json()) as ParseCommandResult;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const client = createSupabaseBrowserClient();
      const nextPreview = await resolveCommandPreview(client, user.id, result.command, clientDateOptions());
      setCommand(result.command);
      setPreview(nextPreview);
    } catch {
      setError('Command interpretation is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleChoose = async (choice: ResolvedReference) => {
    if (!command) return;
    const nextPreview = await buildPreviewForReference(command, choice, clientDateOptions());
    setPreview(nextPreview);
  };

  const handleConfirm = async () => {
    if (!user || !preview) return;

    if (preview.kind === 'found') {
      const runId = uuid();
      saveDraft(runId, {
        workout: preview.reference.workout,
        source: 'manual',
        templateId: preview.reference.kind === 'template' ? preview.reference.id : null,
      });
      router.push(`/review/${runId}`);
      return;
    }

    setConfirming(true);
    try {
      const client = createSupabaseBrowserClient();
      const result = await commitCommandAction(client, user.id, preview);
      if (result.ok) {
        reset();
        router.push('/calendar');
      } else {
        setError(result.message);
      }
    } catch {
      setError('Something went wrong applying that. Try again.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-2 text-lg font-semibold">Ask about your workouts</h2>
      <p className="mb-3 text-sm text-text-muted">
        Try &quot;use yesterday&apos;s workout&quot;, &quot;schedule Upper Body for Monday at 7am&quot;, or &quot;move
        Wednesday&apos;s workout to Friday&quot;.
      </p>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Type a command…"
          className="focus-ring flex-1 rounded-lg border border-border bg-bg px-3 py-2.5"
        />
        <Button onClick={handleSubmit} disabled={loading || text.trim() === ''}>
          {loading ? '…' : 'Go'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {preview && (
        <div className="mt-4">
          <CommandConfirmPreview
            preview={preview}
            onChoose={handleChoose}
            onConfirm={handleConfirm}
            onCancel={reset}
            confirming={confirming}
          />
        </div>
      )}
    </Card>
  );
}
