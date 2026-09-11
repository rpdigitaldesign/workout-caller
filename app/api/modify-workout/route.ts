import { NextResponse } from 'next/server';
import { z } from 'zod';
import { modifyWorkoutWithInstruction } from '@/lib/anthropic/modifyWorkout';
import { requireUserAndRateLimit } from '@/lib/anthropic/apiHelpers';
import { LIMITS, WorkoutSchema } from '@/lib/workout/schema';

const RequestSchema = z.object({
  workout: WorkoutSchema,
  instruction: z.string().max(LIMITS.MAX_INSTRUCTION_CHARS + 100),
});

export async function POST(request: Request) {
  const guard = await requireUserAndRateLimit();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_ai_output', message: 'Malformed request.' }, { status: 400 });
  }

  const parsedBody = RequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, error: 'invalid_ai_output', message: 'Request payload was invalid.' }, { status: 400 });
  }

  const result = await modifyWorkoutWithInstruction(parsedBody.data.workout, parsedBody.data.instruction);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
