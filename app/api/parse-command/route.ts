import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseWorkoutCommand } from '@/lib/anthropic/parseCommand';
import { requireUserAndRateLimit } from '@/lib/anthropic/apiHelpers';
import { LIMITS } from '@/lib/workout/schema';

// Claude only ever extracts intent + a raw descriptor/date phrase here — it
// never resolves an absolute date, so no "now"/timezone context is needed
// for this call. Date/reference resolution happens afterward in
// lib/commands/executeCommand.ts using the client's real local time.
const RequestSchema = z.object({
  text: z.string().max(LIMITS.MAX_COMMAND_TEXT_CHARS + 100),
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
    return NextResponse.json({ ok: false, error: 'input_too_long', message: 'Request payload was invalid.' }, { status: 400 });
  }

  const result = await parseWorkoutCommand(parsedBody.data.text);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
