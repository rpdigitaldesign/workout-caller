import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseWorkoutFromText } from '@/lib/anthropic/parseWorkout';
import { requireUserAndRateLimit } from '@/lib/anthropic/apiHelpers';
import { LIMITS } from '@/lib/workout/schema';

const RequestSchema = z.object({
  rawText: z.string().max(LIMITS.MAX_RAW_TEXT_CHARS + 100), // small slack; parseWorkoutFromText enforces the real limit with a friendly message
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
    return NextResponse.json({ ok: false, error: 'input_too_long', message: 'Request payload was invalid or too large.' }, { status: 400 });
  }

  const result = await parseWorkoutFromText(parsedBody.data.rawText);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
