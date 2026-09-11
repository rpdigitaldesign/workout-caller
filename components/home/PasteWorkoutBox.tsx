'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { saveDraft } from '@/lib/workout/draftStore';
import type { ParseWorkoutResult } from '@/lib/workout/schema';
import { LIMITS } from '@/lib/workout/schema';

export function PasteWorkoutBox() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInterpret = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text }),
      });
      const result = (await response.json()) as ParseWorkoutResult;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const draftId = uuid();
      saveDraft(draftId, { workout: result.workout, source: 'ai' });
      router.push(`/review/${draftId}`);
    } catch {
      setError('The AI workout parser is temporarily unavailable. You can still create the workout manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-2 text-lg font-semibold">Paste your workout</h2>
      <p className="mb-3 text-sm text-text-muted">
        Write it however feels natural — rounds, durations, rests. Workout text is sent to Anthropic only when you
        use this feature.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={LIMITS.MAX_RAW_TEXT_CHARS}
        rows={6}
        placeholder={
          '3 rounds\n\nGoblet squats - 40 seconds\nRest - 20 seconds\nPush-ups - 30 seconds\n\n1 minute between rounds'
        }
        className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button onClick={handleInterpret} disabled={loading || text.trim() === ''}>
          {loading ? 'Interpreting…' : 'Interpret Workout'}
        </Button>
        <Button variant="secondary" onClick={() => router.push('/create')}>
          Create Manually
        </Button>
      </div>
    </Card>
  );
}
