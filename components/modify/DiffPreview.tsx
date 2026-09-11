import type { Workout, WorkoutStep } from '@/lib/workout/schema';
import { Card } from '@/components/ui/Card';

interface StepDiffRow {
  kind: 'unchanged' | 'changed' | 'added' | 'removed';
  before: WorkoutStep | null;
  after: WorkoutStep | null;
}

function diffStepLists(before: WorkoutStep[], after: WorkoutStep[]): StepDiffRow[] {
  const beforeById = new Map(before.map((s) => [s.id, s]));
  const afterById = new Map(after.map((s) => [s.id, s]));
  const rows: StepDiffRow[] = [];

  for (const step of after) {
    const prior = beforeById.get(step.id);
    if (!prior) {
      rows.push({ kind: 'added', before: null, after: step });
    } else if (prior.name !== step.name || prior.durationSeconds !== step.durationSeconds || prior.type !== step.type) {
      rows.push({ kind: 'changed', before: prior, after: step });
    } else {
      rows.push({ kind: 'unchanged', before: prior, after: step });
    }
  }
  for (const step of before) {
    if (!afterById.has(step.id)) {
      rows.push({ kind: 'removed', before: step, after: null });
    }
  }
  return rows;
}

function describeStep(step: WorkoutStep): string {
  return step.durationSeconds !== null ? `${step.name} — ${step.durationSeconds} sec` : step.name;
}

export function DiffPreview({ original, modified }: { original: Workout; modified: Workout }) {
  const rows = diffStepLists(original.steps, modified.steps).filter((r) => r.kind !== 'unchanged');
  const roundsChanged = original.rounds !== modified.rounds;
  const roundRestChanged = original.roundRestSeconds !== modified.roundRestSeconds;
  const titleChanged = original.title !== modified.title;

  const nothingChanged = rows.length === 0 && !roundsChanged && !roundRestChanged && !titleChanged;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">What changed</h2>
      {nothingChanged && <p className="text-sm text-text-muted">No changes detected.</p>}
      <div className="flex flex-col gap-2 text-sm">
        {titleChanged && (
          <div>
            <span className="text-text-muted line-through">{original.title}</span>
            {' → '}
            <span className="font-semibold">{modified.title}</span>
          </div>
        )}
        {roundsChanged && (
          <div>
            Rounds: <span className="text-text-muted line-through">{original.rounds}</span> →{' '}
            <span className="font-semibold">{modified.rounds}</span>
          </div>
        )}
        {roundRestChanged && (
          <div>
            Rest between rounds:{' '}
            <span className="text-text-muted line-through">{original.roundRestSeconds ?? 'none'}</span> →{' '}
            <span className="font-semibold">{modified.roundRestSeconds ?? 'none'}</span>
          </div>
        )}
        {rows.map((row, i) => (
          <div key={i}>
            {row.kind === 'changed' && (
              <>
                <span className="text-text-muted line-through">{describeStep(row.before!)}</span>
                {' → '}
                <span className="font-semibold">{describeStep(row.after!)}</span>
              </>
            )}
            {row.kind === 'added' && <span className="text-accent">+ {describeStep(row.after!)}</span>}
            {row.kind === 'removed' && <span className="text-danger line-through">− {describeStep(row.before!)}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
